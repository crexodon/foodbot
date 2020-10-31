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
        this.chat_orderer = 0;
        this.waiting_for_orderer = 0;
        this.is_ordering = 0;
        this.orders = [];
        this.restaurant = '';
    }
}

// Function to check for the right object.
// Returns the index of the user in chats.
function get_chat(chat_id) {
    return chats.find(chat => chat.chat_id == chat_id);
}

// bot object
const bot = new Telegraf(config.botToken);
bot.use(commandParts());

// /start command to start the bot and have it register a chat
bot.start((ctx) => {
    let chat = new telegram_chat(ctx.chat.id);
    chats.push(chat);
    console.log('New Chat: ' + ctx.chat.id);
    ctx.reply('Welcome to the FoodBot. Use /order to announce a group order, /add to add a menu item to the order and /done to close the order and generate a list');
});

// /order command to begin a group order and open the orders for the chat
bot.command('order', (ctx) => {
    let chat = get_chat(ctx.chat.id);
        chat.chat_orderer = ctx.from.id;
        chat.waiting_for_orderer = 1;
        chat.is_ordering = 1;
        chat.orders = [];
        chat.restaurant = ctx.state.command.args;

    if (ctx.state.command.args != '') {
        chat.waiting_for_orderer = 0;
        ctx.reply(ctx.from.first_name + ' (@' + ctx.from.username + ')' + ' is starting a group order at ' + chat.restaurant + '\nPlease add your orders with /add "menu item"', Markup.inlineKeyboard([
            Markup.callbackButton('Cancel Order', 'cancel')
        ]).extra());
    } else {
        chat.waiting_for_orderer = 1;
        ctx.reply("Please reply with the name of the restaurant", Markup.inlineKeyboard([
            Markup.callbackButton('Cancel Order', 'cancel')
        ]).extra());
    }
});

// /add command to add items to a open order
bot.command('add', (ctx) => {
    let chat = get_chat(ctx.chat.id);

    if (chat.is_ordering == 1) {
        if (ctx.state.command.args != '') {
            let item = [ctx.from.id, ctx.from.username, ctx.state.command.args, 1];
            chat.orders.push(item);
            ctx.reply(ctx.state.command.args + ' added', Markup.inlineKeyboard([
                Markup.callbackButton('Delete ' + ctx.state.command.args, 'delete'),
                Markup.callbackButton('+1 this', 'increment')
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

    if (chat.chat_orderer == ctx.from.username) {
        chat.is_ordering = 0;
        ctx.reply('Orders are closed');

        let reply = chat.orders.map(order => '- ' + order).join('\n');

        ctx.reply(reply);
    } else {
        ctx.reply("You aren't the person who opened the order");
    }
});

bot.command('status', (ctx) => {
    let chat = get_chat(ctx.chat.id);
    if(chat.is_ordering){
        ctx.reply('Currently @' + chat.chat_orderer + ' is ordering at: ' + chat.restaurant + '\nOrders so far:\n' + chat.orders);
    } else {
        ctx.reply('Currently no one is ordering. Use /order "restaurant or the inline keyboard to start a order');
    }
})

bot.on('text', (ctx) => {
    let chat = get_chat(ctx.chat.id);

    if(chat.waiting_for_orderer && ctx.message.username == chat.chat_orderer){
        chat.restaurant = ctx.message;
        ctx.reply(ctx.from.first_name + ' (@' + ctx.from.username + ')' + ' is starting a group order at ' + chat.restaurant + '\nPlease add your orders with /add "menu item"', Markup.inlineKeyboard([
            Markup.callbackButton('Cancel Order', 'cancel')
        ]).extra())
        chat.waiting_for_orderer = 0;
    }
})

bot.action('cancel', (ctx) => {
    let chat = get_chat(ctx.chat.id);

    if(chat.chat_orderer == ctx.from.id){
        chat.chat_orderer = 0;
        chat.waiting_for_orderer = 0;
        chat.is_ordering = 0;
        chat.orders = [];
        chat.restaurant = '';
    
        ctx.reply('Order has been canceled');
        console.log('Order canceled');
    }
})

bot.action('delete', (ctx) => {
    let chat = get_chat(ctx.chat.id);

    if(chat.orders.some(order => order.includes(ctx.from.id))){
        let button = ctx.update.callback_query.message.reply_markup.inline_keyboard[0][0].text.split('Delete ');
        console.log(button[1]);

        if(chat.orders.some(order => order.includes(button))){
            console.log('true dat') //TODO Delete item if found in array
        }
    }
})

bot.action('increment', (ctx) => {

})

// /help command to show a help and statistics of past restaurants
bot.help((ctx) => ctx.reply('FoodBot Help:\nQuick Commands: Use /order to announce a group order, /add to add a menu item to the order and /done to close the order and generate a list\n \nInline Keyboard:\nYou also use the inline keyboard and after issuing a command reply with the restaurant name or menu item.'));

bot.launch();