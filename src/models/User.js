const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ChannelSchema = new Schema({
    guildID: String,
    channelID: String,
});

const UserSchema = new Schema({
    summonerName: String,
    region: String,
    puuidTFT: String,
    puuidLOL: String,
    lastMatchIDLOL: String,
    lastMatchIDTFT: String,
    timeout: Number,
    channels: [ChannelSchema],
});

module.exports = mongoose.model('User', UserSchema);