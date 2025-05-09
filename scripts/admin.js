import { world } from "@minecraft/server";
import { configManager, defaultConfig } from "./config.js";
import { commandManager } from "./commands.js";
import { playerDB } from "./db.js";

// Register admin commands
commandManager.register("config", {
    description: "Manage addon configuration",
    permission: "admin",
    execute: (player, args) => {
        showConfig(player);
        return;
    }
});

// Global mute commands
commandManager.register("globalmute", {
    description: "Enable/disable global chat mute",
    permission: "admin",
    aliases: ["gmute", "servermute"],
    execute: (player, args) => {
        const currentState = configManager.get("globalMute");
        const newState = args[0]?.toLowerCase() === "off" ? false : true;

        if (newState === currentState) {
            player.sendMessage(`${configManager.get("chatPrefix")}§eGlobal mute is already ${newState ? "enabled" : "disabled"}!`);
            return;
        }

        configManager.set("globalMute", newState);

        // Broadcast to all players
        const message = newState
            ? `${configManager.get("chatPrefix")}§c§lGlobal mute enabled! Chat is now disabled.`
            : `${configManager.get("chatPrefix")}§a§lGlobal mute disabled! Chat is now enabled.`;

        for (const p of world.getPlayers()) {
            p.sendMessage(message);
        }
    }
});

function formatTimestamp(ms) {
    const date = new Date(ms);
    const now = Date.now();
    const diff = now - ms;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours   = Math.floor(minutes / 60);
    const days    = Math.floor(hours / 24);

    let relative = "";
    if (days > 0) relative = `${days} day${days > 1 ? "s" : ""} ago`;
    else if (hours > 0) relative = `${hours} hour${hours > 1 ? "s" : ""} ago`;
    else if (minutes > 0) relative = `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
    else relative = "just now";

    return `${date.toLocaleString()} (§7${relative}§r)`;
}

commandManager.register("playerinfo", {
    description: "Show player information",
    permission: "admin",
    execute: (player, args) => {
        const info = playerDB.getPlayerInfo(player.name);

        let formattedInfo = `${configManager.get("chatPrefix")}§ePlayer Info:\n`;

        for (const [name, data] of Object.entries(info)) {
            formattedInfo += `§r§e"${name}": {\n`;
            formattedInfo += `  §r§7"firstJoin": §f${formatTimestamp(data.firstJoin)},\n`;
            formattedInfo += `  §r§7"lastJoin": §f${formatTimestamp(data.lastJoin)},\n`;
            formattedInfo += `  §r§7"joinCount": §f${data.joinCount}\n`;
            formattedInfo += `§e},\n`;
        }

        player.sendMessage(formattedInfo);
    }
});

// Helper functions
function showConfig(player) {
    const config = configManager.getAll();
    player.sendMessage(`${configManager.get("chatPrefix")}§6=== Current Configuration ===`);

    // Iterate through all config items and print them
    for (const [key, value] of Object.entries(config)) {
        if (Array.isArray(value)) {
            player.sendMessage(`§e${key}: §f${value.join(', ')}`);
        } else if (typeof value === 'object') {
            player.sendMessage(`§e${key}: §f${JSON.stringify(value).replace(/"/g, '')}`);
        } else {
            player.sendMessage(`§e${key}: §f${value}`);
        }
    }
}
