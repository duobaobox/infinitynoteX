import { describe, it, expect, vi } from 'vitest';
import { createProxy, IpcInvoker } from '../ipcProxy';

describe('createProxy', () => {
  it('should forward method calls to invoke with prefix', () => {
    // Mock Invoker
    const invoke = vi.fn();
    const invoker: IpcInvoker = { invoke: invoke as unknown as IpcInvoker['invoke'] };

    // Create Proxy
    const proxy = createProxy<any>(invoker, 'test'); // eslint-disable-line @typescript-eslint/no-explicit-any

    // Call dynamic method
    proxy.foo('arg1', 123);

    // Verify invoke was called correctly
    expect(invoke).toHaveBeenCalledWith('test:foo', 'arg1', 123);
  });

  it('should use overrides if provided', () => {
    const invoke = vi.fn();
    const invoker: IpcInvoker = { invoke: invoke as unknown as IpcInvoker['invoke'] };
    const overrideFn = vi.fn();

    const proxy = createProxy<any>(invoker, 'test', {
      // eslint-disable-line @typescript-eslint/no-explicit-any
      bar: overrideFn, // override
    });

    // Call overridden method
    proxy.bar('arg2');
    // Call dynamic method
    proxy.baz('arg3');

    // Verify behavior
    expect(overrideFn).toHaveBeenCalledWith('arg2');
    expect(invoke).not.toHaveBeenCalledWith('test:bar', expect.anything());
    expect(invoke).toHaveBeenCalledWith('test:baz', 'arg3');
  });
});
