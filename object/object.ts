// object/object.ts
// Valores que maneja el evaluador en tiempo de ejecución y el entorno (ámbito) de variables.
// Cada valor de ChoomScript es un objeto con type() e inspect(), no un valor nativo de JS:
// así el evaluador puede distinguir, por ejemplo, un retorno o un error de un valor normal.
import type { BlockStatement, Identifier } from "../ast/ast.ts";
import { Token, positionOf } from "../token/token.ts";

// ---------- Tipos ----------
export const ObjectTypes = {
  INTEGER: "INTEGER",
  BOOLEAN: "BOOLEAN",
  STRING: "STRING",
  ARRAY: "ARRAY",
  HASH: "HASH",
  RETURN_VALUE: "RETURN_VALUE",
  ERROR: "ERROR",
  FUNCTION: "FUNCTION",
  BUILTIN: "BUILTIN",
  NULL: "NULL",
} as const;

export type ObjectType = (typeof ObjectTypes)[keyof typeof ObjectTypes];

// Se llama LangObject (y no Object) para no tapar el Object global de JS.
export interface LangObject {
  type(): ObjectType;
  inspect(): string; // representación legible para mostrar al usuario
}

// Valores que pueden ser clave de un hash: enteros, booleanos y cadenas.
// hashKey() incluye el tipo para que la clave 1 y la clave "1" no choquen.
export interface Hashable extends LangObject {
  hashKey(): string;
}

// ---------- Valores ----------
export class Integer implements Hashable {
  // number pierde precisión por encima de 2^53 (Go usaba int64);
  // por eso el evaluador reporta desbordamiento al salir de ese rango.
  constructor(public readonly value: number) {}

  type(): ObjectType { return ObjectTypes.INTEGER; }
  inspect(): string { return String(this.value); }
  hashKey(): string { return `${this.type()}:${this.value}`; }
}

export class Bool implements Hashable {
  constructor(public readonly value: boolean) {}

  type(): ObjectType { return ObjectTypes.BOOLEAN; }
  // Se muestran con las mismas palabras con las que se escriben en el código.
  inspect(): string { return this.value ? "online" : "offline"; }
  hashKey(): string { return `${this.type()}:${this.value}`; }
}

export class StringObj implements Hashable {
  constructor(public readonly value: string) {}

  type(): ObjectType { return ObjectTypes.STRING; }
  inspect(): string { return this.value; }
  hashKey(): string { return `${this.type()}:${this.value}`; }
}

// Dentro de arreglos y hashes las cadenas se muestran con comillas para distinguir "1" de 1.
function inspectNested(obj: LangObject): string {
  return obj instanceof StringObj ? `"${obj.value}"` : obj.inspect();
}

export class ArrayObj implements LangObject {
  constructor(public readonly elements: LangObject[]) {}

  type(): ObjectType { return ObjectTypes.ARRAY; }
  inspect(): string {
    return `[${this.elements.map(inspectNested).join(", ")}]`;
  }
}

export class HashObj implements LangObject {
  // hashKey() → par original. Se guarda la clave original para poder mostrarla.
  // Map conserva el orden de inserción, así el hash se imprime en el orden en que se escribió.
  readonly pairs = new Map<string, { key: Hashable; value: LangObject }>();

  type(): ObjectType { return ObjectTypes.HASH; }
  inspect(): string {
    const parts = [...this.pairs.values()]
      .map(({ key, value }) => `${inspectNested(key)}: ${inspectNested(value)}`)
      .join(", ");
    return `{${parts}}`;
  }

  get(key: Hashable): LangObject | undefined {
    return this.pairs.get(key.hashKey())?.value;
  }

  // Si la clave ya existe se reemplaza su valor: {"a": 1, "a": 2} queda {"a": 2}.
  set(key: Hashable, value: LangObject): void {
    this.pairs.set(key.hashKey(), { key, value });
  }
}

export function isHashable(obj: LangObject): obj is Hashable {
  return obj instanceof Integer || obj instanceof Bool || obj instanceof StringObj;
}

// Envuelve el valor de un "delta" para que el evaluador lo distinga de un valor
// ordinario y pueda propagarlo fuera de los bloques hasta el quickhack que lo llamó.
export class ReturnValue implements LangObject {
  constructor(public readonly value: LangObject) {}

  type(): ObjectType { return ObjectTypes.RETURN_VALUE; }
  inspect(): string { return this.value.inspect(); }
}

export class Null implements LangObject {
  type(): ObjectType { return ObjectTypes.NULL; }
  inspect(): string { return "null"; }
}

// Error en tiempo de ejecución (no es una excepción de JS: es un valor del lenguaje
// que el evaluador propaga hacia arriba hasta detener el programa).
export class ErrorObj implements LangObject {
  // token: dónde ocurrió el error. Lo asigna el evaluador; null si aún no se conoce.
  constructor(
    public readonly message: string,
    public readonly token: Token | null = null
  ) {}

  type(): ObjectType { return ObjectTypes.ERROR; }
  inspect(): string {
    const where = this.token === null ? "" : ` en ${positionOf(this.token)}`;
    return `[FLATLINE] Error de ejecución${where}: ${this.message}`;
  }
}

// Un quickhack ya evaluado: parámetros, cuerpo y el entorno donde se definió.
// Conservar ese entorno es lo que permite las clausuras (closures).
export class FunctionObj implements LangObject {
  constructor(
    public readonly parameters: Identifier[],
    public readonly body: BlockStatement,
    public readonly env: Environment
  ) {}

  type(): ObjectType { return ObjectTypes.FUNCTION; }
  inspect(): string {
    const params = this.parameters.map((p) => p.toString()).join(", ");
    return `quickhack(${params}) {...}`;
  }
}

// Función integrada, escrita en TypeScript (holo, len, str...).
export class BuiltinObj implements LangObject {
  constructor(
    public readonly name: string,
    public readonly arity: number | null, // cantidad de argumentos; null = cualquier cantidad
    public readonly fn: (args: LangObject[]) => LangObject
  ) {}

  type(): ObjectType { return ObjectTypes.BUILTIN; }
  inspect(): string { return `builtin ${this.name}`; }
}

// Instancias reutilizadas para los valores nulos y booleanos.
// Sirven como singletons del lenguaje y simplifican la evaluación.
export const TRUE = new Bool(true);
export const FALSE = new Bool(false);
export const NULL = new Null();

// ---------- Entorno ----------
// Almacena nombres y valores de un ámbito. Cada llamada a un quickhack crea un
// entorno nuevo cuyo "outer" es el entorno donde se definió el quickhack.
export class Environment {
  private readonly store = new Map<string, LangObject>();

  // Sin argumento: entorno global. Con argumento: entorno hijo (equivale a NewEnclosedEnvironment).
  constructor(private readonly outer: Environment | null = null) {}

  // Busca el nombre en este ámbito y, si no está, en los exteriores (de adentro hacia afuera).
  get(name: string): LangObject | undefined {
    return this.store.get(name) ?? this.outer?.get(name);
  }

  // choom: declara en ESTE ámbito, aunque el nombre exista en uno exterior (lo tapa).
  set(name: string, val: LangObject): LangObject {
    this.store.set(name, val);
    return val;
  }

  // Asignación (x = ...): actualiza la variable en el ámbito más cercano donde fue
  // declarada. Devuelve false si no existe en ningún ámbito.
  assign(name: string, val: LangObject): boolean {
    if (this.store.has(name)) {
      this.store.set(name, val);
      return true;
    }
    return this.outer !== null && this.outer.assign(name, val);
  }
}
