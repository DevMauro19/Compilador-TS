//object/object.ts
// Valores y entornos previstos para el evaluador.
// El REPL actual no sólo persiste variables: también expone builtins del lenguaje.
import type { BlockStatement, Identifier } from "../ast/ast.ts";

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

export class HashKey {
  constructor(
    public readonly type: string,
    public readonly value: string | number
  ) {}

  equals(other: HashKey): boolean {
    return this.type === other.type && this.value === other.value;
  }
}

export interface Hashable {
  hashKey(): HashKey;
  inspect(): string;
}

// Se llama LangObject (y no Object) para no tapar el Object global de JS.
export interface LangObject {
  type(): ObjectType;
  inspect(): string; // representación legible para mostrar al usuario
}

// ---------- Valores ----------
export class Integer implements LangObject, Hashable {
  // number pierde precisión por encima de 2^53 (Go usaba int64).
  // Es coherente con IntegerLiteral.value del AST; cambia ambos a bigint si lo necesitas.
  constructor(public readonly value: number) {}

  type(): ObjectType { return ObjectTypes.INTEGER; }
  inspect(): string { return String(this.value); }
  hashKey(): HashKey { return new HashKey(ObjectTypes.INTEGER, this.value); }
}

export class Bool implements LangObject, Hashable {
  constructor(public readonly value: boolean) {}

  type(): ObjectType { return ObjectTypes.BOOLEAN; }
  inspect(): string { return String(this.value); }
  hashKey(): HashKey { return new HashKey(ObjectTypes.BOOLEAN, this.value ? 1 : 0); }
}

export class StringObj implements LangObject, Hashable {
  constructor(public readonly value: string) {}

  type(): ObjectType { return ObjectTypes.STRING; }
  inspect(): string { return this.value; }
  hashKey(): HashKey { return new HashKey(ObjectTypes.STRING, this.value); }
}

export class ArrayObj implements LangObject {
  constructor(public readonly elements: LangObject[]) {}

  type(): ObjectType { return ObjectTypes.ARRAY; }
  inspect(): string {
    return `[${this.elements.map((element) => element.inspect()).join(", ")}]`;
  }
}

export class HashObj implements LangObject {
  constructor(
    public readonly pairs: Array<{ key: Hashable; value: LangObject }>
  ) {}

  type(): ObjectType { return ObjectTypes.HASH; }
  inspect(): string {
    const parts = this.pairs
      .map(({ key, value }) => `${key.inspect()}: ${value.inspect()}`)
      .join(", ");
    return `{${parts}}`;
  }

  get(key: Hashable): LangObject | undefined {
    const targetKey = key.hashKey();
    const pair = this.pairs.find(({ key: current }) =>
      current.hashKey().equals(targetKey)
    );
    return pair?.value;
  }
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

export class BuiltinObj implements LangObject {
  constructor(public readonly fn: (...args: LangObject[]) => LangObject) {}

  type(): ObjectType { return ObjectTypes.BUILTIN; }
  inspect(): string { return "builtin function"; }
}

// Instancias reutilizadas para los valores nulos y booleanos.
// Sirven como singletons del lenguaje y simplifican la evaluación.
export const TRUE = new Bool(true);
export const FALSE = new Bool(false);
export const NULL = new Null();

export const builtins = new Map<string, BuiltinObj>([
  [
    "print",
    new BuiltinObj((...args: LangObject[]) => {
      console.log(args.map((arg) => arg.inspect()).join(" "));
      return NULL;
    }),
  ],
  [
    "len",
    new BuiltinObj((...args: LangObject[]) => {
      if (args.length !== 1) {
        return new ErrorObj(`len() espera 1 argumento, recibió ${args.length}`);
      }

      if (args[0] instanceof ArrayObj) {
        return new Integer(args[0].elements.length);
      }
      if (args[0] instanceof HashObj) {
        return new Integer(args[0].pairs.length);
      }
      if (args[0] instanceof StringObj) {
        return new Integer(args[0].value.length);
      }

      return new ErrorObj(`len() no admite ${args[0].type()}`);
    }),
  ],
  [
    "first",
    new BuiltinObj((...args: LangObject[]) => {
      if (args.length !== 1 || !(args[0] instanceof ArrayObj)) {
        return new ErrorObj("first() requiere un arreglo");
      }
      if (args[0].elements.length === 0) {
        return NULL;
      }
      return args[0].elements[0];
    }),
  ],
  [
    "last",
    new BuiltinObj((...args: LangObject[]) => {
      if (args.length !== 1 || !(args[0] instanceof ArrayObj)) {
        return new ErrorObj("last() requiere un arreglo");
      }
      if (args[0].elements.length === 0) {
        return NULL;
      }
      return args[0].elements[args[0].elements.length - 1];
    }),
  ],
  [
    "rest",
    new BuiltinObj((...args: LangObject[]) => {
      if (args.length !== 1 || !(args[0] instanceof ArrayObj)) {
        return new ErrorObj("rest() requiere un arreglo");
      }
      if (args[0].elements.length === 0) {
        return new ArrayObj([]);
      }
      return new ArrayObj(args[0].elements.slice(1));
    }),
  ],
  [
    "push",
    new BuiltinObj((...args: LangObject[]) => {
      if (args.length !== 2 || !(args[0] instanceof ArrayObj)) {
        return new ErrorObj("push() requiere un arreglo y un valor");
      }
      const arr = args[0].elements.slice();
      arr.push(args[1]);
      return new ArrayObj(arr);
    }),
  ],
]);

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
    const local = this.store.get(name);
    if (local !== undefined) {
      return local;
    }
    if (this.outer !== null) {
      return this.outer.get(name);
    }
    return builtins.get(name);
  }

  has(name: string): boolean {
    return this.store.has(name) || (this.outer !== null && this.outer.has(name));
  }

  // Guarda en este entorno, aunque el nombre exista en uno exterior.
  set(name: string, val: LangObject): LangObject {
    this.store.set(name, val);
    return val;
  }

  // Actualiza la variable en el entorno más cercano donde existe.
  // Si no existe, la crea en el entorno actual.
  assign(name: string, val: LangObject): LangObject {
    if (this.store.has(name)) {
      this.store.set(name, val);
      return val;
    }
    if (this.outer) {
      this.outer.assign(name, val);
      return val;
    }
    this.store.set(name, val);
    return val;
  }
}