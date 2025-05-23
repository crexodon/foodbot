const { Telegraf } = require('telegraf');
const config = require('./config');
const Markup = require('telegraf/markup');

// Global array for chat objects.
const chats = {};

// Chat object to store stuff.
class telegram_chat {
    constructor(chat_id) {
        this.chat_id = chat_id;
        this.chat_orderer = null;
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
    return chats[chat_id];
}

function itemNameEquals(a, b) {
    return a.toUpperCase() == b.toUpperCase();
}

function getExistingItemName(chat, itemName) {
    return chat.orders.find(order => itemNameEquals(order.itemName, itemName))?.itemName;
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

    let totalCount = 0;
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
            totalCount++;
        }

        toReturn.push(`${fromArray.length}x ${itemName}\n${Object.values(countPerUser).map(userCount => `    ${userCount.count}x ${(userCount.user.username || userCount.user.first_name)}`).join('\n')}`);
    }

    return toReturn.join('\n') + `\n\nTotal items: ${totalCount}`;
}

// bot object
const bot = new Telegraf(config.botToken);

// /start command to start the bot and have it register a chat
bot.start((ctx) => {
    if(get_chat(ctx.chat.id) != null){
        ctx.reply('This chat is already registered!');
        return;
    }

    let chat = new telegram_chat(ctx.chat.id);
    chats[ctx.chat.id] = chat;
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

    if (ctx.args.length > 0) {
        chat.chat_orderer = ctx.from;
        chat.is_ordering = 1;
        chat.orders = [];
        chat.restaurant = ctx.args.join(' ');
        ctx.reply(ctx.from.first_name + ' (@' + (ctx.from.username || ctx.from.first_name) + ')' + ' is starting a group order at ' + chat.restaurant + '\nPlease add your orders with /add "menu item"', Markup.inlineKeyboard([
            Markup.button.callback('Cancel Order', 'cancel')
        ]));
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

    console.log(ctx.args);

    if (chat.is_ordering == 1) {
        if (ctx.args.length > 0) {
            let itemName = ctx.args.join(' ');

            let existingName = getExistingItemName(chat, itemName);
            if (existingName)
                itemName = existingName;

            let item = new orderItem(ctx.from, itemName);
            chat.orders.push(item);
            ctx.reply(itemName + ' added', Markup.inlineKeyboard([
                Markup.button.callback('Delete ' + itemName, 'delete'),
                Markup.button.callback('+1 ' + itemName, 'increment')
            ]))
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

    if (!chat.is_ordering) {
        ctx.reply("There is no order running!");
        return;
    }

    if (chat.chat_orderer.id == ctx.from.id) {
        chat.is_ordering = 0;

        let reply = printOrders(chat.orders);
        ctx.reply('Orders are closed: \n'+reply);
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

    if (chat.is_ordering == 1) {
        let item = chat.orders.find(order => order.from.id == ctx.from.id && itemNameEquals(order.itemName, input[1]));
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

    if (chat.is_ordering == 1){
        let itemName = ctx.update.callback_query.message.reply_markup.inline_keyboard[0][1].text.split('+1 ')[1];

        let existingName = getExistingItemName(chat, itemName);
        if (existingName)
            itemName = existingName;

        console.log(ctx.update.callback_query.message.reply_markup.inline_keyboard);

        ctx.reply(`${(ctx.from.username || ctx.from.first_name)}: ${itemName} +1`, 
            Markup.inlineKeyboard([
                Markup.button.callback('Delete ' + itemName, 'delete'),
                Markup.button.callback('+1 ' + itemName, 'increment')
            ]));
        chat.orders.push(new orderItem(ctx.from, itemName));
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