# foodbot
Simple NodeJS based Telegraf bot that helps with organizing group food orders

Uses Telegraf, Telegraf-Command-Parts and NodeJS. Add your bot token to the config-sample.js file and rename it to config.js

This has the following commands:

- /start
Initializes the bot and creates the object storage field

- /order
Creates a order and clears the storage field for the chat

- /add
adds a item to the order

- /status
shows the current status of the order

- /done
closes the order and prints a list of all items for this order
