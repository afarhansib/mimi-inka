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

commandManager.register("playerinfo", {
    description: "Show player information",
    permission: "admin",
    execute: (player, args) => {
        // console.log(JSON.stringify(args, null, 2));
        const info = playerDB.getPlayerInfo(player.name);
        player.sendMessage(`${configManager.get("chatPrefix")}§ePlayer Info: ${JSON.stringify(info, null, 2)}`);
        return;
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