const Telegraf = require('telegraf');
const commandParts = require('telegraf-command-parts');
const config = require('./config');

// Global array for chat objects.
const chats = [];

// Chat object to store stuff.
function telegram_chat() {
    this.chat_id = null;
    this.chat_orderer = null;
    this.is_ordering = 0;
    this.orders = [];
    this.restaurants = [];
    this.collect = '';
}

// Function to check for the right object.
// Returns the index of the user in chats.
function auth_chat(chat_id) {
    for(var i = 0; i < chats.length; i++)
    {
        if (chats[i].chat_id === chat_id) {
            return i;
        }
    }
    return 0;
}

// bot object
const bot = new Telegraf(config.botToken);
bot.use(commandParts());

// /start command to start the bot and have it register a chat
bot.start((ctx) => {
    chats.push(new telegram_chat());
    chats[chats.length - 1].chat_id = ctx.message.chat.id;
    chats[chats.length - 1].chat_orderer = null;
    chats[chats.length - 1].is_ordering = 0;
    chats[chats.length - 1].orders = [];
    chats[chats.length - 1].restaurants = [];
    chats[chats.length - 1].collect = '';
    console.log(chats.length)
    ctx.reply('Welcome to the FoodBot. Use /order to announce a group order, /add to add a menu item to the order and /done to close the order and generate a list');
    
});

// /order command to begin a group order and open the orders for the chat
bot.command('order', (ctx) => {
    if(ctx.state.command.args != ''){
        chats[auth_chat(ctx.message.chat.id)].chat_orderer = ctx.from.username;
        chats[auth_chat(ctx.message.chat.id)].is_ordering = 1;
        chats[auth_chat(ctx.message.chat.id)].orders = [];
        chats[auth_chat(ctx.message.chat.id)].restaurants.push(ctx.state.command.args);
        chats[auth_chat(ctx.message.chat.id)].collect = '';
        ctx.reply(ctx.from.first_name + ' (@' + ctx.from.username + ')' + ' is starting a group order at ' + ctx.state.command.args + '\nPlease add your orders with /add "menu item"');
    } else {
        ctx.reply('Please state the restaurant name after /order "restaurant"')
    }
    console.log('order');
});

// /add command to add orders to a open order
bot.command('add', (ctx) => {
    if(chats[auth_chat(ctx.message.chat.id)].is_ordering == 1){
        if(ctx.state.command.args != ''){
            chats[auth_chat(ctx.message.chat.id)].orders.push(ctx.state.command.args);
        } else {
            ctx.reply('Please state your menu item after /add "menu item"');
        }
    } else {
        ctx.reply("There isn't a open order currently");
    }
    console.log(ctx.message.chat.id + ' ' + ctx.state.command.args);
});

// /done command to close a order and have it display a summary
bot.command('done', (ctx) => {
    if(chats[auth_chat(ctx.message.chat.id)].chat_orderer == ctx.message.from.username) {
        chats[auth_chat(ctx.message.chat.id)].is_ordering = 0;
        ctx.reply('Orders are closed');

        // TODO Needs check to group duplicates and display amounts
        for(var i = 0; i < chats[auth_chat(ctx.message.chat.id)].orders.length; i++) {
            chats[auth_chat(ctx.message.chat.id)].collect += chats[auth_chat(ctx.message.chat.id)].orders[i] + '\n'
        }

        ctx.reply(chats[auth_chat(ctx.message.chat.id)].collect);
    } else {
        ctx.reply("You aren't the person who opened the order")
    }
});

// /help command to show a help and statistics of past restaurants
bot.help((ctx) => ctx.reply('FoodBot Help. Use /order to announce a group order, /add to add a menu item to the order and /done to close the order and generate a list'))
bot.launch()