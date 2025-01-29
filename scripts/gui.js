import { world } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { playerDB, muteDB } from "./db.js";
import { configManager } from "./config.js";

export class CommandGUI {
    static async showMainMenu(player) {
        const form = new ActionFormData()
            .title("Command Menu")
            .body("Select an action:")
            .button("Manage Titles")
            .button("Manage Nametags")
            .button("Manage Mutes")
            .button("View Player Info");

        const response = await form.show(player);
        if (response.canceled) return;

        switch (response.selection) {
            case 0:
                await this.showTitleManager(player);
                break;
            case 1:
                await this.showNametagManager(player);
                break;
            case 2:
                await this.showMuteManager(player);
                break;
            case 3:
                await this.showPlayerInfo(player);
                break;
        }
    }

    static getPlayerOptions() {
        // Get online players sorted by name
        const onlinePlayers = [...world.getPlayers()]
            .map(p => p.name)
            .sort((a, b) => a.localeCompare(b));

        // Get all known players from logs
        const allPlayers = playerDB.getAllPlayers();

        // Combine lists (online players first, then offline players not already included)
        const allOptions = [...new Set([...onlinePlayers, ...allPlayers])];
        
        return {
            onlinePlayers,
            allPlayers: allOptions
        };
    }

    static async showPlayerSelector(form, initialValue = "") {
        const { onlinePlayers, allPlayers } = this.getPlayerOptions();
        
        // Add manual name input (first priority)
        form.textField("Player Name:", "Enter player name", initialValue);
        
        // Add online players dropdown if any are online (second priority)
        if (onlinePlayers.length > 0) {
            form.dropdown("Or Select Online Player:", ["<Manual Entry>", ...onlinePlayers], 0);
        }
        
        // Add all known players dropdown (third priority)
        if (allPlayers.length > 0) {
            form.dropdown("Or Select Known Player:", ["<Manual Entry>", ...allPlayers], 0);
        }
    }

    static getSelectedPlayer(values) {
        const [manualName, onlineIndex, historyIndex] = values;
        
        // First priority: Manual name if not empty
        if (manualName.trim()) {
            return manualName.trim();
        }
        
        const { onlinePlayers, allPlayers } = this.getPlayerOptions();
        
        // Second priority: Selected online player
        if (onlineIndex > 0 && onlinePlayers[onlineIndex - 1]) {
            return onlinePlayers[onlineIndex - 1];
        }
        
        // Third priority: Selected historical player
        if (historyIndex > 0 && allPlayers[historyIndex - 1]) {
            return allPlayers[historyIndex - 1];
        }
        
        return null;
    }

    static async showTitleManager(player) {
        const glyphs = configManager.get("glyphs");
        const hasGlyphs = glyphs && glyphs.length > 0;
        
        const form = new ModalFormData()
            .title("Title Manager");

        // Add player selection options
        await this.showPlayerSelector(form);
        
        form.dropdown("Mode:", ["Chat", "In-game"], 0);

        if (hasGlyphs) {
            form.toggle("Use Glyph", false);
            // Show each glyph with its hex position 
            const glyphOptions = glyphs.map((glyph, index) => {
                const hex = index.toString(16).padStart(2, '0').toUpperCase();
                return `${hex} ${glyph}`; // Shows like "⚔ (A4)"
            });
            form.dropdown("Glyph:", glyphOptions, 0);
            form.textField("Custom Text:", "Enter custom text (optional)");
        } else {
            form.textField("Title:", "Enter title (or leave empty to remove)");
        }

        if (hasGlyphs) {
            form.dropdown("Position:", ["Top", "Before", "After", "Below"], 0);
        }

        const response = await form.show(player);
        if (response.canceled) return;

        // Get selected player from the response values
        const targetName = this.getSelectedPlayer(response.formValues.slice(0, 3));
        const [, , , modeIndex, ...rest] = response.formValues;

        if (!targetName) {
            player.sendMessage("§cPlease specify a player!");
            return;
        }

        const mode = modeIndex === 0 ? "chat" : "ingame";
        
        let title, position;
        if (hasGlyphs) {
            const [useGlyph, glyphIndex, customText, positionIndex] = rest;
            if (!useGlyph && !customText) {
                playerDB.removeCustomization(targetName, "title", mode);
                player.sendMessage(`§aRemoved ${mode} title for ${targetName}`);
                return;
            }

            title = useGlyph ? glyphs[glyphIndex] : customText;
            position = ["top", "before", "after", "below"][positionIndex];
        } else {
            [title] = rest;
            position = "top";
        }

        if (title) {
            if (mode === "ingame") {
                playerDB.setCustomization(targetName, "title", { text: title, position }, mode);
                player.sendMessage(`§aSet ${mode} title for ${targetName} to: ${title} (${position})`);
            } else {
                playerDB.setCustomization(targetName, "title", title, mode);
                player.sendMessage(`§aSet ${mode} title for ${targetName} to: ${title}`);
            }
        } else {
            playerDB.removeCustomization(targetName, "title", mode);
            player.sendMessage(`§aRemoved ${mode} title for ${targetName}`);
        }

        // Update in-game display if needed
        if (mode === "ingame") {
            const targetPlayer = [...world.getPlayers()].find(p => p.name === targetName);
            if (targetPlayer) {
                // Reset nametag first
                targetPlayer.nameTag = targetName;
                
                if (title) {
                    const currentName = playerDB.getCustomization(targetName, "nametag", "ingame") || targetName;
                    switch (position) {
                        case "top":
                            targetPlayer.nameTag = `${title}\n${currentName}`;
                            break;
                        case "before":
                            targetPlayer.nameTag = `${title} ${currentName}`;
                            break;
                        case "after":
                            targetPlayer.nameTag = `${currentName} ${title}`;
                            break;
                        case "below":
                            targetPlayer.nameTag = `${currentName}\n${title}`;
                            break;
                    }
                }
            }
        }
    }

    static async showNametagManager(player) {
        const glyphs = configManager.get("glyphs");
        const hasGlyphs = glyphs && glyphs.length > 0;
        
        const form = new ModalFormData()
            .title("Nametag Manager");

        // Add player selection options
        await this.showPlayerSelector(form);
        
        form.dropdown("Mode:", ["Chat", "In-game"], 0);

        if (hasGlyphs) {
            form.toggle("Use Glyph", false);
            // Show each glyph with its hex position
            const glyphOptions = glyphs.map((glyph, index) => {
                const hex = index.toString(16).padStart(2, '0').toUpperCase();
                return `${glyph} (${hex})`; // Shows like "⚔ (A4)"
            });
            form.dropdown("Glyph:", glyphOptions, 0);
            form.textField("Custom Text:", "Enter custom text (optional)");
        } else {
            form.textField("Nametag:", "Enter nametag (or leave empty to remove)");
        }

        const response = await form.show(player);
        if (response.canceled) return;

        // Get selected player from the response values
        const targetName = this.getSelectedPlayer(response.formValues.slice(0, 3));
        const [, , , modeIndex, ...rest] = response.formValues;

        if (!targetName) {
            player.sendMessage("§cPlease specify a player!");
            return;
        }

        const mode = modeIndex === 0 ? "chat" : "ingame";
        
        let nametag;
        if (hasGlyphs) {
            const [useGlyph, glyphIndex, customText] = rest;
            if (!useGlyph && !customText) {
                playerDB.removeCustomization(targetName, "nametag", mode);
                player.sendMessage(`§aRemoved ${mode} nametag for ${targetName}`);
                return;
            }
            nametag = useGlyph ? glyphs[glyphIndex] : customText;
        } else {
            [nametag] = rest;
        }

        if (nametag) {
            playerDB.setCustomization(targetName, "nametag", nametag, mode);
            player.sendMessage(`§aSet ${mode} nametag for ${targetName} to: ${nametag}`);

            // Update in-game display if needed
            if (mode === "ingame") {
                const targetPlayer = [...world.getPlayers()].find(p => p.name === targetName);
                if (targetPlayer) {
                    // Reset nametag first
                    targetPlayer.nameTag = targetName;
                    
                    // Check for title
                    const title = playerDB.getCustomization(targetName, "title", "ingame");
                    if (title) {
                        switch (title.position) {
                            case "top":
                                targetPlayer.nameTag = `${title.text}\n${nametag}`;
                                break;
                            case "before":
                                targetPlayer.nameTag = `${title.text} ${nametag}`;
                                break;
                            case "after":
                                targetPlayer.nameTag = `${nametag} ${title.text}`;
                                break;
                            case "below":
                                targetPlayer.nameTag = `${nametag}\n${title.text}`;
                                break;
                        }
                    } else {
                        targetPlayer.nameTag = nametag;
                    }
                }
            }
        } else {
            playerDB.removeCustomization(targetName, "nametag", mode);
            player.sendMessage(`§aRemoved ${mode} nametag for ${targetName}`);
        }
    }

    static async showMuteManager(player) {
        const muteSettings = muteDB.get("muteSettings", {});
        const playerSettings = muteSettings[player.name] || {};
        
        let body = "";
        if (playerSettings.muteAll) {
            const exceptions = playerSettings.exceptions || [];
            body = "Mute Status: All players muted\n\nExceptions:\n" + 
                (exceptions.length > 0 
                    ? exceptions.map(p => `- ${p}`).join("\n")
                    : "None");
        } else {
            const muted = playerSettings.muted || [];
            body = "Muted players:\n" + 
                (muted.length > 0 
                    ? muted.map(p => `- ${p}`).join("\n")
                    : "None");
        }

        const form = new ActionFormData()
            .title("Mute Manager")
            .body(body)
            .button(playerSettings.muteAll ? "Disable Mute All" : "Enable Mute All")
            .button(playerSettings.muteAll ? "Add Exception" : "Mute Player")
            .button("Back to Main Menu");

        const response = await form.show(player);
        if (response.canceled) return;

        switch (response.selection) {
            case 0:
                // Toggle mute all
                playerSettings.muteAll = !playerSettings.muteAll;
                if (playerSettings.muteAll) {
                    playerSettings.exceptions = [];
                }
                muteSettings[player.name] = playerSettings;
                muteDB.set("muteSettings", muteSettings);
                player.sendMessage(playerSettings.muteAll 
                    ? "§aAll players will now be muted (except those you unmute)"
                    : "§aAll players will now be unmuted (except those you mute)"
                );
                await this.showMuteManager(player);
                break;
            case 1:
                // Show add exception/mute player form
                await this.showMuteNewPlayer(player);
                break;
            case 2:
                await this.showMainMenu(player);
                break;
        }
    }

    static async showMuteNewPlayer(player) {
        const form = new ModalFormData()
            .title("Mute Player")
            .textField("Player Name:", "Enter player name");

        const response = await form.show(player);
        if (response.canceled) {
            await this.showMuteManager(player);
            return;
        }

        const [targetName] = response.formValues;
        if (!targetName) {
            player.sendMessage("§cPlease enter a player name!");
            await this.showMuteManager(player);
            return;
        }

        let muteSettings = muteDB.get("muteSettings", {});
        muteSettings[player.name] = muteSettings[player.name] || {};
        
        if (muteSettings[player.name].muteAll) {
            muteSettings[player.name].exceptions = muteSettings[player.name].exceptions || [];
            muteSettings[player.name].exceptions.push(targetName);
            player.sendMessage(`§aAdded ${targetName} to mute exceptions`);
        } else {
            muteSettings[player.name].muted = muteSettings[player.name].muted || [];
            muteSettings[player.name].muted.push(targetName);
            player.sendMessage(`§aMuted player: ${targetName}`);
        }
        
        muteDB.set("muteSettings", muteSettings);
        await this.showMuteManager(player);
    }

    static async showPlayerInfo(player) {
        const form = new ModalFormData()
            .title("Player Info");

        // Add player selection options
        await this.showPlayerSelector(form);
        
        const response = await form.show(player);
        if (response.canceled) return;

        // Get selected player from the response values
        const targetName = this.getSelectedPlayer(response.formValues.slice(0, 3));

        if (!targetName) {
            player.sendMessage("§cPlease specify a player!");
            return;
        }

        const chatTitle = playerDB.getCustomization(targetName, "title", "chat");
        const chatNametag = playerDB.getCustomization(targetName, "nametag", "chat");
        const ingameTitle = playerDB.getCustomization(targetName, "title", "ingame");
        const ingameNametag = playerDB.getCustomization(targetName, "nametag", "ingame");

        player.sendMessage([
            `§6=== Info for ${targetName} ===`,
            chatTitle ? `§7Chat Title: §f${chatTitle}` : "§7Chat Title: §8None",
            chatNametag ? `§7Chat Nametag: §f${chatNametag}` : "§7Chat Nametag: §8None",
            ingameTitle ? `§7In-game Title: §f${ingameTitle.text} (${ingameTitle.position})` : "§7In-game Title: §8None",
            ingameNametag ? `§7In-game Nametag: §f${ingameNametag}` : "§7In-game Nametag: §8None"
        ].join("\n"));
    }
}