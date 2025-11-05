import "dotenv/config";
import { AIMessage, BaseMessage } from "langchain";

declare global {
    function displayMessage(message: BaseMessage): void;
    function displayStream(stream: AsyncIterable<[BaseMessage, never]>): Promise<void>;
}

type MessageType = BaseMessage["type"];

type Icon = {
    [k in MessageType]: string;
};

type Color = {
    [k in MessageType]: string;
}

/**
 * Little setup file to provide helper functions for the notebooks.
 */

/**
 * Display a message in a nice format.
 * @param message The message to display.
 * @returns void
 */
globalThis.displayMessage = (message: BaseMessage) => {
    const icons: Icon = {
        human: "👤",
        ai: "🤖",
        tool: "🔧",
        custom: "💡",
        system: "🖥️"
    };

    const colors: Color = {
        human: "\x1b[36m",  // Cyan
        ai: "\x1b[35m",     // Magenta
        tool: "\x1b[33m",   // Yellow
        custom: "\x1b[31m", // Red
        system: "\x1b[32m", // Green
        reset: "\x1b[0m"    // reset color
    };

    const icon = icons[message.type] || "💬";
    const color = colors[message.type] || "";
    const reset = colors.reset;

    // Header
    console.log(`\n${color}┌${"─".repeat(60)}┐${reset}`);
    console.log(`${color}│ ${icon} ${message.type.toUpperCase()} MESSAGE${" ".repeat(60 - message.type.length - 12)}│${reset}`);
    console.log(`${color}└${"─".repeat(60)}┘${reset}`);

    // Content
    if (message.content) {
        console.log(message.content);
    } else if (message.type === 'ai') {
        console.log("Tool Calls:");
        (message as AIMessage).tool_calls?.forEach((call, idx) => {
            console.log(`  ${idx + 1}. ${call.name}()`);
            console.log(`     ${JSON.stringify(call.args, null, 2).split('\n').join('\n     ')}`);
        });
    }
}

/**
 * A helper function to stream a message.
 * @param message The message to stream.
 * @returns void
 */
globalThis.displayStream = async (stream: AsyncIterable<[BaseMessage, never]>) => {
    let content = "";
    for await (const [message] of stream) {
        content += message.content;
        await Deno.jupyter.broadcast("update_display_data", {
            data: { "text/html": `<b>${content}</b>` },
            metadata: {},
            transient: { display_id: "progress" }
        });
    }
}