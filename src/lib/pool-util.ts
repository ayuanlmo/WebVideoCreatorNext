import genericPool from "generic-pool";

// generic-pool 通用辅助

// generic-pool 资源工厂接口
export interface IPoolFactory<T> {
    create: () => Promise<T>; // 创建资源
    destroy: (resource: T) => Promise<void> | void; // 销毁资源
    validate?: (resource: T) => boolean | Promise<boolean>; // 校验资源是否可用
}

// generic-pool 池选项（常用字段显式声明，其余透传）
export interface IPoolOptions {
    max?: number; // 池内资源最大数量
    min?: number; // 池内资源最小数量
    autostart?: boolean; // 是否自动启动池（WVC中固定为false，由warmup显式启动）
    // 其它generic-pool支持的选项
    [key: string]: unknown;
}

// generic-pool 池对象
export type TPool<T> = genericPool.Pool<T>;

interface IWaiter {
    settled: boolean;

    reject(error: unknown): void;

    resolve(resource: unknown): void;
}

const poolWaiters = new WeakMap<object, Set<IWaiter>>();

// 创建资源池
export function createPool<T>(factory: IPoolFactory<T>, options: IPoolOptions = {}): TPool<T> {
    // IPoolFactory/IPoolOptions 与 generic-pool 的 Factory/Options 形状等价，仅泛型签名不同
    const pool = genericPool.createPool(factory as unknown as genericPool.Factory<T>, options as unknown as genericPool.Options) as TPool<T>;
    const waiters = new Set<IWaiter>();
    poolWaiters.set(pool, waiters);
    const originalAcquire = pool.acquire.bind(pool);
    pool.acquire = (priority?: number): Promise<T> => {
        const waiter: IWaiter = {settled: false, reject: null, resolve: null};
        const promise = new Promise<T>((resolve, reject): void => {
            waiter.resolve = resolve;
            waiter.reject = reject;
            originalAcquire(priority).then(
                (resource): void => {
                    waiters.delete(waiter);
                    if (waiter.settled) {
                        // 等待者已被创建错误reject，迟到的资源直接销毁避免泄漏
                        Promise.resolve(pool.destroy(resource)).catch((): void => {
                        });
                        return;
                    }
                    waiter.settled = true;
                    resolve(resource);
                },
                (error): void => {
                    waiters.delete(waiter);
                    if (waiter.settled)
                        return;
                    waiter.settled = true;
                    reject(error);
                }
            );
        });
        waiters.add(waiter);
        return promise;
    };
    return pool;
}

// 转发工厂创建错误到等待中的客户端
export function forwardFactoryCreateError<T>(pool: TPool<T>, onError: (error: Error) => void): void {
    pool.on("factoryCreateError", (error: Error): void => {
        const waiters = poolWaiters.get(pool);
        const waiter = waiters && [...waiters].find((w): boolean => !w.settled);
        if (!waiter) {
            onError(error);
            return;
        }
        waiter.settled = true;
        waiters.delete(waiter);
        waiter.reject(error);
    });
}