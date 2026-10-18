export function hiddenPrompt(message) {
  return new Promise(resolve => {
    process.stdout.write(message);
    let value = "";
    process.stdin.setRawMode(true);
    process.stdin.setEncoding("utf8");
    process.stdin.resume();
    const handler = chunk => {
      for (const char of chunk) {
        if (char === "\u0003") { process.stdout.write("\n"); process.exit(130); }
        if (char === "\r" || char === "\n") {
          process.stdin.off("data", handler);
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdout.write("\n");
          resolve(value);
          return;
        }
        if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
        else if (char >= " ") value += char;
      }
    };
    process.stdin.on("data", handler);
  });
}
