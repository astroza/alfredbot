"use strict";

const secret = process.env['SECRET'];
const botPassword = process.env['BOT_PASSWORD'];
const URLBase = process.env['URL_BASE'];

const express = require('express');
const expressApp = express();
const beautify = require("json-beautify");
const
  Telegraf = require('telegraf'),
  LocalSession = require('telegraf-session-local')

const bot = new Telegraf(process.env['TELEGRAM_TOKEN']);
var localSession = new LocalSession({ database: 'alfredbot_db.json' });
bot.use(localSession.middleware());
bot.telegram.setWebhook(`${URLBase}/${secret}/telegram`);

expressApp.use(express.json());
expressApp.use(bot.webhookCallback(`/${secret}/telegram`));

bot.command('/start', (ctx) => {
  ctx.reply(`Para suscribirse a eventos y tener acceso a servicios, utiliza /login <password> para autenticarte`)
})

bot.command('/login', (ctx) => {
  let pw = ctx.message.text.split(' ')[1];
  if(pw == botPassword) {
    ctx.session.authenticated = true
    ctx.reply(`${ctx.from.first_name}, ahora estas suscrito a los eventos del depto`)
  }
})

var batteryState = {}
bot.command('/battery', async (ctx) => {
  if(!ctx.session.authenticated) {
    ctx.reply(`Antes de cualquier cosa usa /login <password>, ${ctx.from.first_name}`)
    return
  }
  for(let upsName in batteryState) {
      await ctx.reply(beautify(Object.fromEntries(Object.entries(batteryState[upsName])), null, 2, 100));
  }
});

bot.command('/logout', (ctx) => {
  ctx.reply("Bye")
  ctx.session = null
})

bot.catch((err, ctx) => {
  console.log(`Ooops, encountered an error for ${ctx.updateType}`, err)
  process.exit(1)
})

var batteryIsDischarging = {};
expressApp.post(`/${secret}/ups-state`, async function(request, response) {
  var state = request.body;
  var upsName = state['ups.name'];
  batteryState[upsName] = state;
  if(state['ups.status'] != "OL") {
    if(!batteryIsDischarging[upsName]) {
      batteryIsDischarging[upsName] = true;
      let notifications = localSession.DB.get('sessions').value().map(async session => {
        await bot.telegram.sendMessage(session.id, `*Alerta: UPS ${upsName}*\nSe corto la energia\nRevisa el estado de la bateria con /battery`, {parse_mode: "MarkdownV2"});
      });
      await Promise.all(notifications);
    }
  } else {
    if(batteryIsDischarging[upsName]) {
      batteryIsDischarging[upsName] = false;
      let notifications = localSession.DB.get('sessions').value().map(async session => {
        await bot.telegram.sendMessage(session.id, `*Aviso: UPS ${upsName}*\nVolvio la energia :D`, {parse_mode: "MarkdownV2"});
      });
      await Promise.all(notifications);
    }
  }
  response.send("ok");
});

expressApp.listen(8001);
