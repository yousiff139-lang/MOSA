export interface DomainEvent {
  eventName: string;
  timestamp: Date;
}

export type EventHandler<T extends DomainEvent> = (event: T) => void | Promise<void>;

export interface IEventBus {
  publish<T extends DomainEvent>(event: T): void;
  subscribe<T extends DomainEvent>(eventName: string, handler: EventHandler<T>): void;
  unsubscribe<T extends DomainEvent>(eventName: string, handler: EventHandler<T>): void;
}

export class EventBus implements IEventBus {
  private handlers: Map<string, EventHandler<any>[]> = new Map();

  public publish<T extends DomainEvent>(event: T): void {
    const eventHandlers = this.handlers.get(event.eventName);
    if (eventHandlers) {
      eventHandlers.forEach(handler => handler(event));
    }
  }

  public subscribe<T extends DomainEvent>(eventName: string, handler: EventHandler<T>): void {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, []);
    }
    this.handlers.get(eventName)!.push(handler);
  }

  public unsubscribe<T extends DomainEvent>(eventName: string, handler: EventHandler<T>): void {
    const eventHandlers = this.handlers.get(eventName);
    if (eventHandlers) {
      this.handlers.set(
        eventName,
        eventHandlers.filter(h => h !== handler)
      );
    }
  }
}
