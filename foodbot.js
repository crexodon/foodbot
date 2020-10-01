const Telegraf = require('telegraf');
const commandParts = require('telegraf-command-parts');
const config = require('./config');

// Global array for chat objects.
const chats = [];

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
    let chat = new telegram_chat(ctx.message.chat.id);
    chats.push(chat);
    console.log('New Chat: ' + ctx.message.chat.id)
    ctx.reply('Welcome to the FoodBot. Use /order to announce a group order, /add to add a menu item to the order and /done to close the order and generate a list');
});

// /order command to begin a group order and open the orders for the chat
bot.command('order', (ctx) => {
    if (ctx.state.command.args != '') {
        let chat = get_chat(ctx.message.chat.id);
        chat.chat_orderer = ctx.from.username;
        chat.is_ordering = 1;
        chat.orders = [];
        chat.restaurant = ctx.state.command.args;

        ctx.reply(ctx.from.first_name + ' (@' + ctx.from.username + ')' + ' is starting a group order at ' + chat.restaurant + '\nPlease add your orders with /add "menu item"');
    } else {
        ctx.reply('Please state the restaurant name after /order "restaurant"')
    }
});

// /add command to add orders to a open order
bot.command('add', (ctx) => {
    let chat = get_chat(ctx.message.chat.id);

    if (chat.is_ordering == 1) {
        if (ctx.state.command.args != '') {
            chat.orders.push(ctx.state.command.args);
        } else {
            ctx.reply('Please state your menu item after /add "menu item"');
        }
    } else {
        ctx.reply("There isn't a open order currently");
    }
});

// /done command to close a order and have it display a summary
bot.command('done', (ctx) => {
    let chat = get_chat(ctx.message.chat.id);

    if (chat.chat_orderer == ctx.message.from.username) {
        chat.is_ordering = 0;
        ctx.reply('Orders are closed');

        let reply = chat.orders.map(order => '- ' + order).join('\n');

        ctx.reply(reply);
    } else {
        ctx.reply("You aren't the person who opened the order");
    }
});

// /help command to show a help and statistics of past restaurants
bot.help((ctx) => ctx.reply('FoodBot Help. Use /order to announce a group order, /add to add a menu item to the order and /done to close the order and generate a list'));
bot.launch();
