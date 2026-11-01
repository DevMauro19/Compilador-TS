// interpreter/interpreter.ts
// Une las etapas del intérprete: código fuente → Lexer → Parser → AST → Evaluador.
// Lo usan el REPL, el lector de archivos y los tests, para que los tres se comporten igual.
import { Lexer } from "../lexer/lexer.ts";
import { Parser } from "../parser/parser.ts";
import { Eval } from "../evaluator/evaluator.ts";
import { Environment, ErrorObj, LangObject } from "../object/object.ts";

export type InterpretResult =
  | { ok: true; value: LangObject }
  | { ok: false; errors: string[] };

export function interpret(source: string, env: Environment): InterpretResult {
  const lexer = new Lexer(source);
  const parser = new Parser(lexer);
  // El parser va pidiendo tokens al lexer, así que al terminar de parsear
  // el lexer ya recorrió todo el código y tiene sus errores listos.
  const program = parser.parseProgram();

  // Cada etapa solo se reporta si la anterior no falló: un error léxico suele
  // provocar errores sintácticos en cadena que solo confundirían.
  if (lexer.errors.length > 0) {
    return { ok: false, errors: lexer.errors };
  }
  if (parser.errors.length > 0) {
    return { ok: false, errors: parser.errors };
  }

  try {
    const value = Eval(program, env);
    return value instanceof ErrorObj ? { ok: false, errors: [value.inspect()] } : { ok: true, value };
  } catch (e) {
    // El evaluador es recursivo: una recursión sin caso base agota la pila de JS.
    if (e instanceof RangeError) {
      const overflow = new ErrorObj("recursión demasiado profunda (¿falta el caso base de un quickhack?)");
      return { ok: false, errors: [overflow.inspect()] };
    }
    throw e;
  }
}
