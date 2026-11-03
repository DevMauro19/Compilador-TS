// repl/repl.ts
// REPL (Read-Eval-Print Loop): lee código de la consola, lo ejecuta y muestra el resultado.
// Las variables persisten entre entradas porque todas comparten el mismo Environment.
import * as readline from "node:readline";
import { Lexer } from "../lexer/lexer.ts";
import { TokenTypes } from "../token/token.ts";
import { interpret } from "../interpreter/interpreter.ts";
import { Environment, NULL } from "../object/object.ts";

const PROMPT = "V here> ";
const CONTINUATION_PROMPT = "  ...> ";
const EXIT_COMMAND = "jackout";

export function startRepl(): void {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: PROMPT,
  });

  const env = new Environment();
  let buffer = "";

  console.log("ChoomScript v1.0 · Bienvenido a Night City, choom.");
  console.log(`Escribe código y presiona Enter. Para desconectarte escribe "${EXIT_COMMAND}" o usa Ctrl+C.`);
  rl.prompt();

  rl.on("line", (line: string) => {
    if (buffer === "" && line.trim() === EXIT_COMMAND) {
      rl.close();
      return;
    }

    buffer += line + "\n";

    // Si quedan "(", "[" o "{" sin cerrar seguimos leyendo: así se pueden escribir
    // quickhacks y bloques de varias líneas.
    if (openDelimiters(buffer) > 0) {
      rl.setPrompt(CONTINUATION_PROMPT);
      rl.prompt();
      return;
    }

    const result = interpret(buffer, env);
    buffer = "";

    if (!result.ok) {
      result.errors.forEach((e) => console.error(e));
    } else if (result.value !== NULL) {
      console.log(result.value.inspect());
    }

    rl.setPrompt(PROMPT);
    rl.prompt();
  });

  rl.on("close", () => {
    console.log("\nJacked out. Nos vemos en el Afterlife, choom.");
  });
}

// Cuenta los delimitadores abiertos sin cerrar usando el propio lexer
// (así no se confunde con paréntesis dentro de cadenas o comentarios).
function openDelimiters(source: string): number {
  const lexer = new Lexer(source);
  let depth = 0;

  for (let tok = lexer.nextToken(); tok.type !== TokenTypes.EOF; tok = lexer.nextToken()) {
    if (tok.type === TokenTypes.LPAREN || tok.type === TokenTypes.LBRACKET || tok.type === TokenTypes.LBRACE) {
      depth += 1;
    } else if (tok.type === TokenTypes.RPAREN || tok.type === TokenTypes.RBRACKET || tok.type === TokenTypes.RBRACE) {
      depth -= 1;
    }
  }
  return depth;
}
