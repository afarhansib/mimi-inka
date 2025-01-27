import { world } from "@minecraft/server";
import { configManager, defaultConfig } from "./config.js";
import { commandManager } from "./commands.js";

// Register admin commands
commandManager.register("config", {
    description: "Manage addon configuration",
    permission: "admin",
    execute: (player, args) => {
        if (args.length === 0) {
            showConfig(player);
            return;
        }

        const [action, ...params] = args;
        switch (action.toLowerCase()) {
            case "set":
                handleConfigSet(player, params);
                break;
            case "reset":
                handleConfigReset(player, params);
                break;
            case "show":
                showConfig(player);
                break;
            default:
                player.sendMessage([
                    "§cUsage: !config [set/reset/show]",
                    "§7Set options:",
                    "§7- prefix <prefixes>",
                    "§7- itemtype <item_id>",
                    "§7- itemname <name>",
                    "§7- delay <seconds>",
                    "§7- message <open_message>",
                    "§7- admintag <tag>",
                    "§7- usertag <tag>"
                ].join("\n"));
        }
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
            player.sendMessage(`§eGlobal mute is already ${newState ? "enabled" : "disabled"}!`);
            return;
        }

        configManager.set("globalMute", newState);
        
        // Broadcast to all players
        const message = newState 
            ? "§c§lGlobal mute enabled! Chat is now disabled."
            : "§a§lGlobal mute disabled! Chat is now enabled.";
            
        for (const p of world.getPlayers()) {
            p.sendMessage(message);
        }
    }
});

// Helper functions
function showConfig(player) {
    const config = configManager.getAll();
    player.sendMessage("§6=== Current Configuration ===");
    
    // Show prefixes
    player.sendMessage(`§ePrefixes: §f${config.prefixes.join(", ")}`);
    
    // Show GUI item settings
    const item = config.guiItem;
    player.sendMessage("§eGUI Item:");
    player.sendMessage(`  §7Type: §f${item.typeId}`);
    player.sendMessage(`  §7Name: §f${item.nameTag}`);
    
    // Show GUI open settings
    player.sendMessage(`§eGUI Open Delay: §f${config.guiOpenDelay}s`);
    player.sendMessage(`§eGUI Open Message: §f${config.guiOpenMessage}`);
    
    // Show permission settings
    player.sendMessage(`§eAdmin Tag: §f${config.adminTag}`);
    player.sendMessage(`§eUser Tag: §f${config.userTag}`);
    
    // Show global mute status
    player.sendMessage(`§eGlobal Mute: §f${config.globalMute ? "§cEnabled" : "§aDisabled"}`);
}

function handleConfigSet(player, params) {
    if (params.length < 2) {
        player.sendMessage("§cUsage: !config set <key> <value>");
        return;
    }

    const [key, ...valueParams] = params;
    const value = valueParams.join(" ");

    try {
        switch (key.toLowerCase()) {
            case "prefix":
            case "prefixes":
                configManager.set("prefixes", value.split(",").map(p => p.trim()));
                break;
            case "itemtype":
                configManager.setNested("guiItem", "typeId", value);
                break;
            case "itemname":
                configManager.setNested("guiItem", "nameTag", value);
                break;
            case "delay":
                const delay = parseFloat(value);
                if (isNaN(delay) || delay <= 0) {
                    player.sendMessage("§cDelay must be a positive number!");
                    return;
                }
                configManager.set("guiOpenDelay", delay);
                break;
            case "message":
                if (!value.includes("{delay}")) {
                    player.sendMessage("§cMessage must include {delay} placeholder!");
                    return;
                }
                configManager.set("guiOpenMessage", value);
                break;
            case "admintag":
                configManager.set("adminTag", value);
                break;
            case "usertag":
                configManager.set("userTag", value);
                break;
            default:
                player.sendMessage([
                    "§cInvalid config key. Available options:",
                    "§7- prefix: Command prefixes (comma-separated)",
                    "§7- itemtype: GUI item type ID",
                    "§7- itemname: GUI item name",
                    "§7- delay: GUI open delay in seconds",
                    "§7- message: GUI open message (must include {delay})",
                    "§7- admintag: Admin permission tag",
                    "§7- usertag: User permission tag"
                ].join("\n"));
                return;
        }
        player.sendMessage(`§aSuccessfully updated ${key} to: ${value}`);
    } catch (error) {
        player.sendMessage(`§cError updating config: ${error.message}`);
    }
}

function handleConfigReset(player, params) {
    if (params.length === 0) {
        // Reset all
        for (const [key, value] of Object.entries(defaultConfig)) {
            configManager.set(key, value);
        }
        player.sendMessage("§aReset all configuration to defaults!");
    } else {
        // Reset specific key
        const key = params[0];
        if (key in defaultConfig) {
            configManager.set(key, defaultConfig[key]);
            player.sendMessage(`§aReset ${key} to default value!`);
        } else {
            player.sendMessage("§cInvalid config key!");
        }
    }
}