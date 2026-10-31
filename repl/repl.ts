//repl/index.ts
declare const require: (id: string) => any;
declare const process: any;
const readline = require("readline");
import { Lexer } from "../lexer/lexer.ts";
import { Parser } from "../parser/parser.ts";
import { Eval } from "../evaluator/evaluator.ts";
import { Environment } from "../object/object.ts";

const PROMPT = ">> ";

export function start(): void {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: PROMPT,
  });

  const env = new Environment();
  rl.prompt();

  rl.on("line", (line: string) => {
    const lexer = new Lexer(line);
    const parser = new Parser(lexer);
    const program = parser.parseProgram();

    if (parser.errors.length > 0) {
      console.log("Errores de parseo:");
      parser.errors.forEach((e) => console.log("\t" + e));
    } else {
      const result = Eval(program, env);
      if (result !== null) {
        console.log(result.inspect());
      }
    }

    rl.prompt();
  });

  rl.on("close", () => {
    console.log("\n¡Hasta luego!");
    process.exit(0);
  });
}

start();