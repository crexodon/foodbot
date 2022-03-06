const Telegraf = require('telegraf');
const commandParts = require('telegraf-command-parts');
const config = require('./config');
const Markup = require('telegraf/markup');

// Global array for chat objects.
const chats = [];

// Chat object to store stuff.
class telegram_chat {
    constructor(chat_id) {
        this.chat_id = chat_id;
        this.chat_orderer = null;
        this.waiting_for_orderer = 0;
        this.is_ordering = 0;
        this.orders = [];
        this.restaurant = '';
    }
}

class orderItem {
    constructor(from, itemName) {
        this.from = from;
        this.itemName = itemName;
    }
}

// Function to check for the right object.
// Returns the index of the user in chats.
function get_chat(chat_id) {
    return chats.find(chat => chat.chat_id == chat_id);
}

function printOrders(orders) {
    let ordersByName = {};
    for (const order of orders) {
        let existing = ordersByName[order.itemName];
        if (existing) {
            existing.push(order.from);
        } else {
            ordersByName[order.itemName] = [order.from];
        }
    }

    let toReturn = [];
    for (const itemName of Object.keys(ordersByName).sort((a, b) => a.localeCompare(b))) {
        const fromArray = ordersByName[itemName];

        let countPerUser = {};
        for (const user of fromArray) {
            let countForUser = countPerUser[user.id];
            if (countForUser) {
                countForUser.count++;
            } else {
                countPerUser[user.id] = { user: user, count: 1 };
            }
        }

        toReturn.push(`${fromArray.length}x ${itemName}\n${Object.values(countPerUser).map(userCount => `    ${userCount.count}x ${(userCount.user.username || userCount.user.first_name)}`).join('\n')}`);
    }

    return toReturn.join('\n');
}

// bot object
const bot = new Telegraf(config.botToken);
bot.use(commandParts());

// /start command to start the bot and have it register a chat
bot.start((ctx) => {
    if(get_chat(ctx.chat.id) != null){
        ctx.reply('This chat is already registered!');
        return;
    }

    let chat = new telegram_chat(ctx.chat.id);
    chats.push(chat);
    console.log('New Chat: ' + ctx.chat.id);
    ctx.reply('Welcome to the FoodBot. Use /order to announce a group order, /add to add a menu item to the order and /done to close the order and generate a list');
});

// /order command to begin a group order and open the orders for the chat
bot.command('order', (ctx) => {
    let chat = get_chat(ctx.chat.id);

    if (chat == null) {
        ctx.reply("run /start first!");
        return;
    }

    if (chat.is_ordering) {
        ctx.reply("An order is already running! use /add to add something to the running order!");
        return;
    }

    if (ctx.state.command.args != '') {
        chat.chat_orderer = ctx.from;
        chat.waiting_for_orderer = 0;
        chat.is_ordering = 1;
        chat.orders = [];
        chat.restaurant = ctx.state.command.args;
        ctx.reply(ctx.from.first_name + ' (@' + (ctx.from.username || ctx.from.first_name) + ')' + ' is starting a group order at ' + chat.restaurant + '\nPlease add your orders with /add "menu item"', Markup.inlineKeyboard([
            Markup.callbackButton('Cancel Order', 'cancel')
        ]).extra());
    } else {
        ctx.reply("Please add the name of the restaurant to your command");
    }
});

// /add command to add items to a open order
bot.command('add', (ctx) => {
    let chat = get_chat(ctx.chat.id);

    if (chat == null) {
        ctx.reply("run /start first!");
        return;
    }

    console.log(ctx.state.command.args);

    if (chat.is_ordering == 1) {
        if (ctx.state.command.args != '') {
            let item = new orderItem(ctx.from, ctx.state.command.args);
            chat.orders.push(item);
            ctx.reply(ctx.state.command.args + ' added', Markup.inlineKeyboard([
                Markup.callbackButton('Delete ' + ctx.state.command.args, 'delete'),
                Markup.callbackButton('+1 ' + ctx.state.command.args, 'increment')
            ]).extra())
        } else {
            ctx.reply('Please state your menu item after /add "menu item"');
        }
    } else {
        ctx.reply("There isn't a open order currently");
    }
});

// /done command to close a order and have it display a summary
bot.command('done', (ctx) => {
    let chat = get_chat(ctx.chat.id);

    if (chat == null) {
        ctx.reply("run /start first!");
        return;
    }

    if (chat.chat_orderer.id == ctx.from.id) {
        chat.is_ordering = 0;
        ctx.reply('Orders are closed');

        let reply = printOrders(chat.orders);

        ctx.reply(reply);
    } else {
        ctx.reply("You aren't the person who opened the order");
    }
});

bot.command('status', (ctx) => {
    let chat = get_chat(ctx.chat.id);

    if (chat == null) {
        ctx.reply("run /start first!");
        return;
    }

    if (chat.is_ordering) {
        ctx.reply('Currently ' + (chat.chat_orderer.username || chat.chat_orderer.first_name) + ' is ordering at: ' + chat.restaurant + '\nOrders so far:\n' + printOrders(chat.orders));
    } else {
        ctx.reply('Currently no one is ordering. Use /order "restaurant or the inline keyboard to start a order');
    }
})

bot.action('cancel', (ctx) => {
    let chat = get_chat(ctx.chat.id);

    if (chat == null) {
        ctx.reply("run /start first!");
        return;
    }

    if (chat.is_ordering && chat.chat_orderer.id == ctx.from.id) {
        chat.chat_orderer = null;
        chat.waiting_for_orderer = 0;
        chat.is_ordering = 0;
        chat.orders = [];
        chat.restaurant = '';

        ctx.reply('Order has been canceled');
        console.log('Order canceled');
    }
    ctx.answerCbQuery();
})

bot.action('delete', (ctx) => {
    let chat = get_chat(ctx.chat.id);

    if (chat == null) {
        ctx.reply("run /start first!");
        return;
    }

    let input = ctx.update.callback_query.message.reply_markup.inline_keyboard[0][0].text.split('Delete '); //TODO Instead include additional callback data and filter with a bot.on function

    if(chat.is_ordering == 1){
        let item = chat.orders.find(order => order.from.id == ctx.from.id && order.itemName == input[1]);
        if (item != null) {
            ctx.reply(`${(ctx.from.username || ctx.from.first_name)}: ${item.itemName} deleted`);
            chat.orders.splice(chat.orders.indexOf(item), 1);
        }
        ctx.answerCbQuery();
    } else {
        ctx.reply('There is no order running');
    }
})

bot.action('increment', (ctx) => {
    let chat = get_chat(ctx.chat.id);

    if (chat == null) {
        ctx.reply("run /start first!");
        return;
    }

    if(chat.is_ordering == 1){
        let input = ctx.update.callback_query.message.reply_markup.inline_keyboard[0][1].text.split('+1 ');
        console.log(ctx.update.callback_query.message.reply_markup.inline_keyboard);

        ctx.reply(`${(ctx.from.username || ctx.from.first_name)}: ${input[1]} +1`);
        chat.orders.push(new orderItem(ctx.from, input[1]));
        console.log(chat);
        ctx.answerCbQuery();
    }else{
        ctx.reply('There is no order running');
    }
})

// /help command to show a help and statistics of past restaurants
bot.help((ctx) => ctx.reply('FoodBot Help:\nQuick Commands: Use /order to announce a group order, /add to add a menu item to the order and /done to close the order and generate a list\n \nInline Keyboard:\nYou also use the inline keyboard and after issuing a command reply with the restaurant name or menu item.'));

bot.launch();

console.log("started");