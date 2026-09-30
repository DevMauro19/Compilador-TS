//object/object.ts
// Valores y entornos previstos para el evaluador.
// El REPL actual todavía no utiliza estos tipos para ejecutar código.
import type { BlockStatement, Identifier } from "../ast/ast.ts";

// ---------- Tipos ----------
export const ObjectTypes = {
  INTEGER: "INTEGER",
  BOOLEAN: "BOOLEAN",
  STRING: "STRING",
  RETURN_VALUE: "RETURN_VALUE",
  ERROR: "ERROR",
  FUNCTION: "FUNCTION",
  NULL: "NULL",
} as const;

export type ObjectType = (typeof ObjectTypes)[keyof typeof ObjectTypes];

// Se llama LangObject (y no Object) para no tapar el Object global de JS.
export interface LangObject {
  type(): ObjectType;
  inspect(): string; // representación legible para mostrar al usuario
}

// ---------- Valores ----------
export class Integer implements LangObject {
  // number pierde precisión por encima de 2^53 (Go usaba int64).
  // Es coherente con IntegerLiteral.value del AST; cambia ambos a bigint si lo necesitas.
  constructor(public readonly value: number) {}

  type(): ObjectType { return ObjectTypes.INTEGER; }
  inspect(): string { return String(this.value); }
}

export class Bool implements LangObject {
  constructor(public readonly value: boolean) {}

  type(): ObjectType { return ObjectTypes.BOOLEAN; }
  inspect(): string { return String(this.value); }
}

export class StringObj implements LangObject {
  constructor(public readonly value: string) {}

  type(): ObjectType { return ObjectTypes.STRING; }
  inspect(): string { return this.value; }
}

// Distingue un retorno de un valor ordinario para que el evaluador
// pueda propagarlo fuera de un bloque.
export class ReturnValue implements LangObject {
  constructor(public readonly value: LangObject) {}

  type(): ObjectType { return ObjectTypes.RETURN_VALUE; }
  inspect(): string { return this.value.inspect(); }
}

export class Null implements LangObject {
  type(): ObjectType { return ObjectTypes.NULL; }
  inspect(): string { return "null"; }
}

// Error en tiempo de ejecución (no es una excepción de JS: es un valor del lenguaje).
export class ErrorObj implements LangObject {
  constructor(public readonly message: string) {}

  type(): ObjectType { return ObjectTypes.ERROR; }
  inspect(): string { return "ERROR: " + this.message; }
}

// Guarda parámetros, cuerpo y entorno de definición.
// Conservar ese entorno permite implementar clausuras.
export class FunctionObj implements LangObject {
  constructor(
    public readonly parameters: Identifier[],
    public readonly body: BlockStatement,
    public readonly env: Environment
  ) {}

  type(): ObjectType { return ObjectTypes.FUNCTION; }
  inspect(): string {
    const params = this.parameters.map((p) => p.toString()).join(", ");
    return `fn(${params}) {...}`;
  }
}

// ---------- Entorno ----------
// Almacena nombres y valores de un ámbito. Si un nombre no existe aquí,
// get() lo busca en los entornos exteriores.
export class Environment {
  private readonly store = new Map<string, LangObject>();

  // Sin argumento: entorno global. Con argumento: entorno hijo (equivale a NewEnclosedEnviroment).
  constructor(private readonly outer: Environment | null = null) {}

  static enclosed(outer: Environment): Environment {
    return new Environment(outer);
  }

  get(name: string): LangObject | undefined {
    return this.store.get(name) ?? this.outer?.get(name);
  }

  // Guarda en este entorno, aunque el nombre exista en uno exterior.
  set(name: string, val: LangObject): LangObject {
    this.store.set(name, val);
    return val;
  }
}