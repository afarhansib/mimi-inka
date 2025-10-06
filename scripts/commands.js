import { system, world } from "@minecraft/server";
import { MenuManager } from "./menu.js";
import { configManager } from "./config.js";
import { playerDB, muteDB } from "./db.js";

class CommandManager {
    constructor() {
        this.commands = new Map();
    }

    register(name, options) {
        this.commands.set(name.toLowerCase(), {
            name: name.toLowerCase(),
            description: options.description || "No description provided",
            permission: options.permission || "none", // none, admin, or custom tag
            execute: options.execute,
            aliases: (options.aliases || []).map(a => a.toLowerCase())
        });
    }

    has(name) {
        name = name.toLowerCase();
        return this.commands.has(name) ||
            [...this.commands.values()].some(cmd => cmd.aliases.includes(name));
    }

    get(name) {
        name = name.toLowerCase();
        return this.commands.get(name) ||
            [...this.commands.values()].find(cmd => cmd.aliases.includes(name));
    }

    execute(player, name, args) {
        const command = this.get(name);
        if (!command) return false;

        // Check permissions using configured tags
        if (command.permission === "admin" && !configManager.hasTag(player, "adminTag")) {
            player.sendMessage(`${configManager.get("chatPrefix")}§cYou don't have permission to use this command!`);
            return true;
        }
        if (command.permission !== "none" && command.permission !== "admin" && !player.hasTag(command.permission)) {
            player.sendMessage(`${configManager.get("chatPrefix")}§cYou don't have permission to use this command!`);
            return true;
        }

        try {
            command.execute(player, args);
        } catch (error) {
            player.sendMessage(`${configManager.get("chatPrefix")}§cAn error occurred while executing the command!`);
            console.warn(`Error executing command ${name}: ${error}`);
        }
        return true;
    }

    getCommands() {
        return [...this.commands.values()];
    }
}

// Create and export the command manager instance
export const commandManager = new CommandManager();

// Register basic commands
commandManager.register("help", {
    description: "Shows list of available commands",
    permission: "none",
    execute: (player, args) => {
        const commands = commandManager.getCommands()
            .filter(cmd => {
                if (cmd.permission === "none") return true;
                if (cmd.permission === "admin") return configManager.hasTag(player, "adminTag");
                return player.hasTag(cmd.permission);
            });

        player.sendMessage(`${configManager.get("chatPrefix")}§6=== Available Commands ===`);
        for (const cmd of commands) {
            player.sendMessage(`§e${configManager.get("prefixes")[0]}${cmd.name}§7: ${cmd.description}`);
        }
    }
});

// Register menu command
commandManager.register("menu", {
    description: "Open the Title Manager menu",
    permission: "admin",
    aliases: ["gui", "titles"],
    execute: (player) => {
        MenuManager.openMenuWithDelay(player);
    }
});

// Register title management commands
commandManager.register("setingame", {
    description: "Set in-game customization for a player",
    permission: "admin",
    execute: (player, args) => {
        let playerName, type, value, position;

        // Check for quoted player name
        const quotedNameMatch = args.join(' ').match(/"([^"]+)"/);
        if (quotedNameMatch) {
            playerName = quotedNameMatch[1]; // Captures the name without quotes
            const startIndex = args.join(' ').indexOf(quotedNameMatch[0]) + quotedNameMatch[0].length; // Find the end of the quoted name
            const remainingArgs = args.join(' ').slice(startIndex).trim().split(' '); // Get remaining arguments
            type = remainingArgs[0]; // First argument after the player name
            value = remainingArgs.slice(1).join(' '); // Join the rest as value
        } else {
            // Fallback to standard argument parsing
            playerName = args[0]; // First argument is player name
            type = args[1]; // Second argument is type
            const valueParts = args.slice(2); // Remaining arguments are value parts
            value = valueParts.join(" "); // Join the rest as value
        }

        // Remove leading @ symbol from player name
        if (playerName?.startsWith('@')) {
            playerName = playerName.slice(1);
        }

        // Validate type and handle logic...
        if (!playerName || !type || !value) {
            player.sendMessage(`${configManager.get("chatPrefix")}§cUsage: ${configManager.get("prefixes")[0]}setingame <player> <type> <value> [position]`);
            return;
        }

        if (!["title", "nametag"].includes(type)) {
            player.sendMessage(`${configManager.get("chatPrefix")}§cInvalid type! Use: title, nametag`);
            return;
        }

        if (type === "title" && ["top", "before", "after", "below"].includes(value.split(" ").pop())) {
            position = value.split(" ").pop();
            value = value.replace(position, "").trim();
        } else {
            position = "top"; // Default position
        }

        playerDB.setCustomization(playerName, type, type === "title" ? { text: value, position } : value, "ingame");

        // Update in-game display if player is online
        const targetPlayer = [...world.getPlayers()].find(p => p.name === playerName);
        if (targetPlayer) {
            const currentName = type === "title"
                ? (playerDB.getCustomization(playerName, "nametag", "ingame") || playerName)
                : value;

            system.run(() => {
                // Reset nametag first
                targetPlayer.nameTag = playerName;

                if (type === "title") {
                    // Apply title with position
                    switch (position) {
                        case "top":
                            targetPlayer.nameTag = `${value}\n${currentName}`;
                            break;
                        case "before":
                            targetPlayer.nameTag = `${value} ${currentName}`;
                            break;
                        case "after":
                            targetPlayer.nameTag = `${currentName} ${value}`;
                            break;
                        case "below":
                            targetPlayer.nameTag = `${currentName}\n${value}`;
                            break;
                    }
                } else {
                    const title = playerDB.getCustomization(playerName, "title", "ingame");
                    if (title) {
                        // Apply title with new nametag
                        switch (title.position) {
                            case "top":
                                targetPlayer.nameTag = `${title.text}\n${value}`;
                                break;
                            case "before":
                                targetPlayer.nameTag = `${title.text} ${value}`;
                                break;
                            case "after":
                                targetPlayer.nameTag = `${value} ${title.text}`;
                                break;
                            case "below":
                                targetPlayer.nameTag = `${value}\n${title.text}`;
                                break;
                        }
                    } else {
                        // No title, just set nametag
                        targetPlayer.nameTag = value;
                    }
                }
            });
        }

        player.sendMessage(configManager.get("chatPrefix") + `§aSet in-game ${type} for ${playerName} to: ${value}${type === "title" ? ` (${position})` : ''}`);
    }
});

commandManager.register("setchat", {
    description: "Set chat customization for a player",
    permission: "admin",
    execute: (player, args) => {
        let playerName, type, value;

        // Check for quoted player name
        const quotedNameMatch = args.join(' ').match(/"([^"]+)"/);
        if (quotedNameMatch) {
            playerName = quotedNameMatch[1]; // Captures the name without quotes
            const startIndex = args.join(' ').indexOf(quotedNameMatch[0]) + quotedNameMatch[0].length; // Find the end of the quoted name
            const remainingArgs = args.join(' ').slice(startIndex).trim().split(' '); // Get remaining arguments
            type = remainingArgs[0]; // First argument after the player name
            value = remainingArgs.slice(1).join(' '); // Join the rest as value
        } else {
            // Fallback to standard argument parsing
            playerName = args[0]; // First argument is player name
            type = args[1]; // Second argument is type
            const valueParts = args.slice(2); // Remaining arguments are value parts
            value = valueParts.join(" "); // Join the rest as value
        }

        // Remove leading @ symbol from player name
        if (playerName?.startsWith('@')) {
            playerName = playerName.slice(1);
        }

        // Validate type and handle logic...
        if (!playerName || !type || !value) {
            player.sendMessage(`${configManager.get("chatPrefix")}§cUsage: ${configManager.get("prefixes")[0]}setchat <player> <type> <value>`);
            return;
        }

        if (!["title", "nametag"].includes(type)) {
            player.sendMessage(`${configManager.get("chatPrefix")}§cInvalid type! Use: title, nametag`);
            return;
        }

        playerDB.setCustomization(playerName, type, value, "chat");
        player.sendMessage(`${configManager.get("chatPrefix")}§aSet chat ${type} for ${playerName} to: ${value}`);
    }
});

commandManager.register("remove", {
    description: "Remove a customization from a player",
    permission: "admin",
    aliases: ["removecustom"],
    execute: (player, args) => {
        let playerName, type, mode;

        // Check for quoted player name
        const quotedNameMatch = args.join(' ').match(/"([^"]+)"/);
        if (quotedNameMatch) {
            playerName = quotedNameMatch[1]; // Captures the name without quotes
            const startIndex = args.join(' ').indexOf(quotedNameMatch[0]) + quotedNameMatch[0].length; // Find the end of the quoted name
            const remainingArgs = args.join(' ').slice(startIndex).trim().split(' '); // Get remaining arguments
            type = remainingArgs[0]; // First argument after the player name
            mode = remainingArgs[1]; // Second argument is mode
        } else {
            // Fallback to standard argument parsing
            playerName = args[0]; // First argument is player name
            type = args[1]; // Second argument is type
            mode = args[2]; // Third argument is mode
        }

        // Remove leading @ symbol from player name
        if (playerName?.startsWith('@')) {
            playerName = playerName.slice(1);
        }

        // Validate type and mode
        if (!playerName || !type || !mode) {
            player.sendMessage(`${configManager.get("chatPrefix")}§cUsage: ${configManager.get("prefixes")[0]}remove <player> <type> <mode>`);
            return;
        }

        if (!["title", "nametag"].includes(type)) {
            player.sendMessage(`${configManager.get("chatPrefix")}§cInvalid type! Use: title, nametag`);
            return;
        }

        if (!["chat", "ingame"].includes(mode)) {
            player.sendMessage(`${configManager.get("chatPrefix")}§cInvalid mode! Use: chat, ingame`);
            return;
        }

        playerDB.removeCustomization(playerName, type, mode);
        player.sendMessage(`${configManager.get("chatPrefix")}§aRemoved ${mode} ${type} for ${playerName}`);

        // Reset in-game display if applicable
        if (mode === "ingame") {
            const targetPlayer = [...world.getPlayers()].find(p => p.name === playerName);
            if (targetPlayer) {
                system.run(() => {
                    const title = playerDB.getCustomization(playerName, "title", "ingame");
                    if (title) {
                        // Apply title with new nametag
                        switch (title.position) {
                            case "top":
                                targetPlayer.nameTag = `${title.text}\n${playerName}`;
                                break;
                            case "before":
                                targetPlayer.nameTag = `${title.text} ${playerName}`;
                                break;
                            case "after":
                                targetPlayer.nameTag = `${playerName} ${title.text}`;
                                break;
                            case "below":
                                targetPlayer.nameTag = `${playerName}\n${title.text}`;
                                break;
                        }
                    }
                    else {
                        const nametag = playerDB.getCustomization(playerName, "nametag", "ingame");
                        if (nametag) {
                            targetPlayer.nameTag = nametag;
                        } else {
                            targetPlayer.nameTag = playerName;
                        }
                    }
                });
            }
        }
    }
});

// Register mute management commands
commandManager.register("muteall", {
    description: "Toggle muting all players for yourself",
    permission: "none",
    execute: (player) => {
        let muteSettings = muteDB.get("muteSettings", {});
        muteSettings[player.name] = muteSettings[player.name] || {};
        muteSettings[player.name].muteAll = !muteSettings[player.name].muteAll;

        // If enabling muteAll, clear individual mutes to save space
        if (muteSettings[player.name].muteAll) {
            muteSettings[player.name].exceptions = [];
        }

        muteDB.set("muteSettings", muteSettings);
        player.sendMessage(muteSettings[player.name].muteAll
            ? `${configManager.get("chatPrefix")}§aAll players will now be muted (except those you unmute)`
            : `${configManager.get("chatPrefix")}§aAll players will now be unmuted (except those you mute)`
        );
    }
});

commandManager.register("mute", {
    description: "Mute a player for yourself",
    permission: "none",
    execute: (player, args) => {
        if (args.length < 1) {
            player.sendMessage(`${configManager.get("chatPrefix")}§cUsage: !mute <player>`);
            return;
        }

        let targetName;
        // Check for quoted player name
        const quotedNameMatch = args.join(' ').match(/"([^"]+)"/);
        if (quotedNameMatch) {
            targetName = quotedNameMatch[1]; // Captures the name without quotes
        } else {
            targetName = args[0]; // First argument is player name
        }

        // Remove leading @ symbol from player name
        if (targetName.startsWith('@')) {
            targetName = targetName.slice(1);
        }

        let muteSettings = muteDB.get("muteSettings", {});
        muteSettings[player.name] = muteSettings[player.name] || { muted: [], exceptions: [] };

        // Mute logic
        if (!muteSettings[player.name]?.muted?.includes(targetName)) {
            muteSettings[player.name]?.muted?.push(targetName);
            const index = muteSettings[player.name].exceptions.indexOf(targetName);
            if (index !== -1) {
                muteSettings[player.name].exceptions.splice(index, 1); // Remove from exceptions if muted
            }
            player.sendMessage(`${configManager.get("chatPrefix")}§aMuted player: ${targetName}`);
        } else {
            player.sendMessage(`${configManager.get("chatPrefix")}§ePlayer ${targetName} is already muted!`);
        }

        muteDB.set("muteSettings", muteSettings);
    }
});

commandManager.register("unmute", {
    description: "Unmute a player",
    permission: "none",
    execute: (player, args) => {
        if (args.length < 1) {
            player.sendMessage(`${configManager.get("chatPrefix")}§cUsage: !unmute <player>`);
            return;
        }

        let targetName;
        // Check for quoted player name
        const quotedNameMatch = args.join(' ').match(/"([^"]+)"/);
        if (quotedNameMatch) {
            targetName = quotedNameMatch[1]; // Captures the name without quotes
        } else {
            targetName = args[0]; // First argument is player name
        }

        // Remove leading @ symbol from player name
        if (targetName.startsWith('@')) {
            targetName = targetName.slice(1);
        }

        let muteSettings = muteDB.get("muteSettings", {});
        muteSettings[player.name] = muteSettings[player.name] || { muted: [], exceptions: [] };

        if (!muteSettings[player.name].exceptions.includes(targetName)) {
            muteSettings[player.name].exceptions.push(targetName);
            const index = muteSettings[player.name].muted.indexOf(targetName);
            if (index !== -1) {
                muteSettings[player.name].muted.splice(index, 1); // Remove from muted if unmuted
            }
            player.sendMessage(`${configManager.get("chatPrefix")}§aUnmuted player: ${targetName}`);
        } else {
            player.sendMessage(`${configManager.get("chatPrefix")}§ePlayer ${targetName} is already unmuted!`);
            return;
        }

        muteDB.set("muteSettings", muteSettings);
    }
});

commandManager.register("mutelist", {
    description: "List players you have muted",
    permission: "none",
    execute: (player) => {
        const muteSettings = muteDB.get("muteSettings", {});
        const playerSettings = muteSettings[player.name] || {};

        if (playerSettings.muteAll) {
            const exceptions = playerSettings.exceptions || [];
            if (exceptions.length === 0) {
                player.sendMessage(configManager.get("chatPrefix") + "§6All players are muted with no exceptions!");
            } else {
                player.sendMessage(configManager.get("chatPrefix") + "§6=== Mute Status ===");
                player.sendMessage("§7All players are muted except:");
                for (const name of exceptions) {
                    player.sendMessage(`§7- §f${name}`);
                }
            }
        } else {
            const muted = playerSettings.muted || [];
            if (muted.length === 0) {
                player.sendMessage(configManager.get("chatPrefix") + "§eYou haven't muted any players!");
                return;
            }
            player.sendMessage(configManager.get("chatPrefix") + "§6=== Muted Players ===");
            for (const name of muted) {
                player.sendMessage(`§7- §f${name}`);
            }
        }
    }
});

commandManager.register("alias", {
    description: "Toggle showing real player gamertags in chat",
    permission: "none",
    execute: (player) => {
        let showAlias = playerDB.get("showAlias", {});
        showAlias[player.name] = !showAlias[player.name];
        playerDB.set("showAlias", showAlias);

        player.sendMessage(showAlias[player.name]
            ? configManager.get("chatPrefix") + "§aReal player gamertags will now be shown in chat"
            : configManager.get("chatPrefix") + "§aReal player gamertags will now be hidden in chat"
        );
    }
});
