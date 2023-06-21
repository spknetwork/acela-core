import {
  ActivityType,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  Message,
  Partials,
  APIEmbedField,
} from 'discord.js'

export class DiscordBot {
  client: Client<boolean>

  async handleMessage(msg: Message<boolean>) {
    console.log(msg)
  }

  async start() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.DirectMessageTyping,
      ],
      partials: [Partials.Channel],
    })
    if(process.env.DISCORD_TOKEN) {
        await this.client.login(process.env.DISCORD_TOKEN)
        await this.client.user.setPresence({
          activities: [{ name: 'Encoding Videos!' }],
          status: 'online',
        })
        this.client.on('messageCreate', this.handleMessage)
    }
  }
}
