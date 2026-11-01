// evaluator/evaluator.ts
// Evaluador: recorre el AST y ejecuta el programa (intérprete de recorrido de árbol).
// Cada nodo devuelve un objeto de ChoomScript (Integer, Bool, ErrorObj, ReturnValue...).
// La idea es la misma que en el evaluator.go original: los errores y los retornos
// se propagan hacia arriba sin seguir ejecutando el resto del bloque.

import {
  type Expression,
  type Statement,
  ArrayLiteral,
  AssignExpression,
  BlockStatement,
  BooleanLiteral,
  CallExpression,
  ExpressionStatement,
  ForExpression,
  FunctionLiteral,
  HashLiteral,
  Identifier,
  IfExpression,
  IndexExpression,
  InfixExpression,
  IntegerLiteral,
  LetStatement,
  PrefixExpression,
  Program,
  ReturnStatement,
  StringLiteral,
  WhileExpression,
} from "../ast/ast.ts";
import {
  ArrayObj,
  Bool,
  BuiltinObj,
  Environment,
  ErrorObj,
  FALSE,
  FunctionObj,
  HashObj,
  Integer,
  LangObject,
  NULL,
  ReturnValue,
  StringObj,
  TRUE,
  isHashable,
} from "../object/object.ts";
import { builtins } from "./builtins.ts";

type AstNode = Program | Statement | Expression;

// Punto de entrada para evaluar cualquier nodo del AST.
export function Eval(node: AstNode, env: Environment): LangObject {
  const result = evalNode(node, env);

  // El primer nodo que ve un error sin posición (el más interno, donde se originó)
  // le asigna su token; así el mensaje apunta a la operación que falló.
  if (result instanceof ErrorObj && result.token === null && !(node instanceof Program)) {
    return new ErrorObj(result.message, node.token);
  }
  return result;
}

function evalNode(node: AstNode, env: Environment): LangObject {
  if (node instanceof Program) {
    return evalProgram(node.statements, env);
  }

  if (node instanceof BlockStatement) {
    return evalBlock(node.statements, env);
  }

  if (node instanceof ExpressionStatement) {
    return Eval(node.expression, env);
  }

  if (node instanceof LetStatement) {
    const value = Eval(node.value, env);
    if (isError(value)) {
      return value;
    }
    env.set(node.name.value, value);
    return NULL;
  }

  if (node instanceof ReturnStatement) {
    const value = Eval(node.returnValue, env);
    if (isError(value)) {
      return value;
    }
    return new ReturnValue(value);
  }

  if (node instanceof IntegerLiteral) {
    return new Integer(node.value);
  }

  if (node instanceof BooleanLiteral) {
    return node.value ? TRUE : FALSE;
  }

  if (node instanceof StringLiteral) {
    return new StringObj(node.value);
  }

  if (node instanceof ArrayLiteral) {
    const elements = evalExpressions(node.elements, env);
    if (isError(elements)) {
      return elements;
    }
    return new ArrayObj(elements);
  }

  if (node instanceof HashLiteral) {
    return evalHash(node, env);
  }

  if (node instanceof Identifier) {
    // Primero los ámbitos del programa (de adentro hacia afuera) y luego las integradas.
    const value = env.get(node.value) ?? builtins.get(node.value);
    if (value !== undefined) {
      return value;
    }
    return new ErrorObj(`'${node.value}' no está definido (¿olvidaste declararlo con choom?)`);
  }

  if (node instanceof PrefixExpression) {
    const right = Eval(node.right, env);
    if (isError(right)) {
      return right;
    }
    return evalPrefix(node.operator, right);
  }

  if (node instanceof InfixExpression) {
    if (node.operator === "&&" || node.operator === "||") {
      return evalLogical(node, env);
    }

    const left = Eval(node.left, env);
    if (isError(left)) {
      return left;
    }

    const right = Eval(node.right, env);
    if (isError(right)) {
      return right;
    }

    return evalInfix(node.operator, left, right);
  }

  if (node instanceof AssignExpression) {
    return evalAssign(node, env);
  }

  if (node instanceof IfExpression) {
    const condition = Eval(node.condition, env);
    if (isError(condition)) {
      return condition;
    }

    if (truthy(condition)) {
      return Eval(node.consequence, env);
    }

    if (node.alternative !== null) {
      return Eval(node.alternative, env);
    }

    return NULL;
  }

  if (node instanceof WhileExpression) {
    return evalLoop(node.condition, node.body, null, env);
  }

  if (node instanceof ForExpression) {
    // La inicialización corre una sola vez, en el mismo ámbito que el resto del código:
    // en ChoomScript solo los quickhacks crean un ámbito nuevo.
    const init = Eval(node.init, env);
    if (isError(init)) {
      return init;
    }
    return evalLoop(node.condition, node.body, node.update, env);
  }

  if (node instanceof FunctionLiteral) {
    // Se captura env: el entorno donde se DEFINE el quickhack (base de los closures).
    return new FunctionObj(node.parameters, node.body, env);
  }

  if (node instanceof CallExpression) {
    const fn = Eval(node.func, env);
    if (isError(fn)) {
      return fn;
    }

    const args = evalExpressions(node.args, env);
    if (isError(args)) {
      return args;
    }

    return applyFunction(fn, args, node.func.toString());
  }

  if (node instanceof IndexExpression) {
    const left = Eval(node.left, env);
    if (isError(left)) {
      return left;
    }

    const index = Eval(node.index, env);
    if (isError(index)) {
      return index;
    }

    return evalIndex(left, index);
  }

  return new ErrorObj(`nodo no soportado: ${node.constructor.name}`);
}

// A nivel de programa un "delta" termina la ejecución: se desenvuelve su valor.
function evalProgram(statements: Statement[], env: Environment): LangObject {
  let result: LangObject = NULL;

  for (const statement of statements) {
    result = Eval(statement, env);

    if (result instanceof ReturnValue) {
      return result.value;
    }

    if (isError(result)) {
      return result;
    }
  }

  return result;
}

// Dentro de un bloque el ReturnValue NO se desenvuelve: tiene que seguir subiendo
// (por ejemplo desde un scan anidado) hasta llegar al quickhack que lo llamó.
function evalBlock(statements: Statement[], env: Environment): LangObject {
  let result: LangObject = NULL;

  for (const statement of statements) {
    result = Eval(statement, env);

    if (result instanceof ReturnValue || isError(result)) {
      return result;
    }
  }

  return result;
}

// En ChoomScript solo offline y null son "falsos".
// Los valores 0, "" y los arreglos vacíos se comportan como verdaderos.
function truthy(value: LangObject): boolean {
  if (value === NULL) {
    return false;
  }

  if (value instanceof Bool) {
    return value.value;
  }

  return true;
}

function evalPrefix(operator: string, right: LangObject): LangObject {
  switch (operator) {
    case "!":
      return truthy(right) ? FALSE : TRUE;
    case "-":
      if (!(right instanceof Integer)) {
        return new ErrorObj(`el operador '-' no se puede aplicar a ${right.type()}`);
      }
      return checkedInteger(-right.value);
    default:
      return new ErrorObj(`operador prefijo desconocido: ${operator}`);
  }
}

// && y || con cortocircuito: si el lado izquierdo ya decide el resultado,
// el derecho ni se evalúa (offline && x nunca evalúa x). Siempre devuelven online/offline.
function evalLogical(node: InfixExpression, env: Environment): LangObject {
  const left = Eval(node.left, env);
  if (isError(left)) {
    return left;
  }

  if (node.operator === "&&" && !truthy(left)) {
    return FALSE;
  }
  if (node.operator === "||" && truthy(left)) {
    return TRUE;
  }

  const right = Eval(node.right, env);
  if (isError(right)) {
    return right;
  }
  return truthy(right) ? TRUE : FALSE;
}

function evalInfix(operator: string, left: LangObject, right: LangObject): LangObject {
  // No hay conversiones implícitas: 1 + "1" es un error (para eso están str() e int()).
  if (left.type() !== right.type()) {
    return new ErrorObj(`tipos incompatibles: ${left.type()} ${operator} ${right.type()}`);
  }

  if (left instanceof Integer && right instanceof Integer) {
    switch (operator) {
      case "+":
        return checkedInteger(left.value + right.value);
      case "-":
        return checkedInteger(left.value - right.value);
      case "*":
        return checkedInteger(left.value * right.value);
      case "/":
        if (right.value === 0) {
          return new ErrorObj("división por cero");
        }
        // División entera: se descarta la parte decimal (7 / 2 = 3, -7 / 2 = -3).
        return checkedInteger(Math.trunc(left.value / right.value));
      case "%":
        if (right.value === 0) {
          return new ErrorObj("módulo por cero");
        }
        return checkedInteger(left.value % right.value);
      case "**":
        if (right.value < 0) {
          return new ErrorObj(`exponente negativo (${right.value}): ChoomScript solo maneja enteros`);
        }
        return checkedInteger(left.value ** right.value);
      case "<":
        return left.value < right.value ? TRUE : FALSE;
      case ">":
        return left.value > right.value ? TRUE : FALSE;
      case "<=":
        return left.value <= right.value ? TRUE : FALSE;
      case ">=":
        return left.value >= right.value ? TRUE : FALSE;
      case "==":
        return left.value === right.value ? TRUE : FALSE;
      case "!=":
        return left.value !== right.value ? TRUE : FALSE;
      default:
        break;
    }
  }

  if (left instanceof StringObj && right instanceof StringObj) {
    switch (operator) {
      case "+":
        return new StringObj(left.value + right.value);
      case "==":
        return left.value === right.value ? TRUE : FALSE;
      case "!=":
        return left.value !== right.value ? TRUE : FALSE;
      default:
        break;
    }
  }

  // Booleanos, null, arreglos, hashes y quickhacks solo se comparan por identidad.
  // Como online/offline/null son singletons, para ellos equivale a comparar el valor.
  if (operator === "==") {
    return left === right ? TRUE : FALSE;
  }

  if (operator === "!=") {
    return left !== right ? TRUE : FALSE;
  }

  return new ErrorObj(`el operador '${operator}' no está definido para ${left.type()}`);
}

// Los number de JS solo representan enteros exactos hasta 2^53; por encima es desbordamiento.
function checkedInteger(value: number): LangObject {
  if (!Number.isSafeInteger(value)) {
    return new ErrorObj("desbordamiento de entero");
  }
  return new Integer(value);
}

function evalHash(node: HashLiteral, env: Environment): LangObject {
  const hash = new HashObj();

  for (const [keyNode, valueNode] of node.pairs) {
    const key = Eval(keyNode, env);
    if (isError(key)) {
      return key;
    }
    if (!isHashable(key)) {
      return new ErrorObj(`un ${key.type()} no puede ser clave de un hash`);
    }

    const value = Eval(valueNode, env);
    if (isError(value)) {
      return value;
    }

    hash.set(key, value);
  }

  return hash;
}

function evalIndex(left: LangObject, index: LangObject): LangObject {
  if (left instanceof ArrayObj) {
    if (!(index instanceof Integer)) {
      return new ErrorObj(`el índice de un arreglo debe ser INTEGER, no ${index.type()}`);
    }
    const idx = index.value;
    if (idx < 0 || idx >= left.elements.length) {
      return new ErrorObj(`índice fuera de rango: ${idx} (el arreglo tiene ${left.elements.length} elementos)`);
    }
    return left.elements[idx];
  }

  if (left instanceof HashObj) {
    if (!isHashable(index)) {
      return new ErrorObj(`un ${index.type()} no puede ser clave de un hash`);
    }
    // Una clave que no existe devuelve null (no es un error).
    return left.get(index) ?? NULL;
  }

  return new ErrorObj(`no se puede indexar un ${left.type()}`);
}

// Ciclo común a netrun y ping: evalúa la condición, ejecuta el cuerpo y, en el ping,
// la actualización. Los ciclos no producen valor (devuelven null), salvo que dentro
// ocurra un error o un delta, que se propagan.
function evalLoop(
  condition: Expression,
  body: BlockStatement,
  update: Expression | null,
  env: Environment
): LangObject {
  while (true) {
    const cond = Eval(condition, env);
    if (isError(cond)) {
      return cond;
    }
    if (!truthy(cond)) {
      return NULL;
    }

    const result = Eval(body, env);
    if (result instanceof ReturnValue || isError(result)) {
      return result;
    }

    if (update !== null) {
      const updated = Eval(update, env);
      if (isError(updated)) {
        return updated;
      }
    }
  }
}

function evalExpressions(expressions: Expression[], env: Environment): LangObject[] | ErrorObj {
  const results: LangObject[] = [];

  for (const expression of expressions) {
    const value = Eval(expression, env);
    if (isError(value)) {
      return value;
    }
    results.push(value);
  }

  return results;
}

// name: cómo se escribió la función en la llamada, solo para los mensajes de error.
function applyFunction(fn: LangObject, args: LangObject[], name: string): LangObject {
  if (!(fn instanceof FunctionObj || fn instanceof BuiltinObj)) {
    return new ErrorObj(`'${name}' es un ${fn.type()}, no un quickhack: no se puede llamar`);
  }

  const expected = fn instanceof FunctionObj ? fn.parameters.length : fn.arity;
  if (expected !== null && args.length !== expected) {
    return new ErrorObj(`${name} espera ${expected} argumento(s) y recibió ${args.length}`);
  }

  if (fn instanceof BuiltinObj) {
    return fn.fn(args);
  }

  // Ámbito nuevo para esta llamada. Su "outer" es el entorno donde se DEFINIÓ el
  // quickhack (no donde se llama): por eso un closure recuerda sus variables.
  const local = new Environment(fn.env);
  fn.parameters.forEach((param, i) => local.set(param.value, args[i]));

  const result = Eval(fn.body, local);
  // Se desenvuelve el ReturnValue aquí; si no, el delta seguiría subiendo
  // y terminaría también el bloque que hizo la llamada.
  return result instanceof ReturnValue ? result.value : result;
}

function evalAssign(node: AssignExpression, env: Environment): LangObject {
  const value = Eval(node.value, env);
  if (isError(value)) {
    return value;
  }

  if (!env.assign(node.name.value, value)) {
    return new ErrorObj(
      `no se puede asignar a '${node.name.value}' porque no ha sido declarado; usa choom ${node.name.value} = ...`
    );
  }
  return value;
}

export function isError(value: LangObject | LangObject[]): value is ErrorObj {
  return value instanceof ErrorObj;
}
