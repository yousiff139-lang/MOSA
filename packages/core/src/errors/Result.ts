export class Result<T, E> {
  private constructor(
    public readonly isSuccess: boolean,
    public readonly isFailure: boolean,
    public readonly error?: E,
    private readonly _value?: T
  ) {}

  public getValue(): T {
    if (!this.isSuccess || this._value === undefined) {
      throw new Error("Can't get the value of an error result. Use 'error' instead.");
    }
    return this._value;
  }

  public static ok<U>(value?: U): Result<U, never> {
    return new Result<U, never>(true, false, undefined, value);
  }

  public static fail<E>(error: E): Result<never, E> {
    return new Result<never, E>(false, true, error);
  }
}
