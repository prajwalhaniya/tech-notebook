---
sidebar_position: 13
title: Synchronization Primitives in C++
---

# Synchronization Primitives in C++

## Introduction to Concurrency

Modern applications often need to perform multiple tasks simultaneously. Whether you're building a web server handling thousands of requests, a video game rendering graphics while processing user input, or a data processing pipeline transforming millions of records, you need **concurrency**.

C++ provides powerful synchronization primitives that allow multiple threads to work together safely without corrupting data or causing race conditions. This article explores these primitives in depth with practical examples.

## The Problem: Race Conditions

Before diving into synchronization primitives, let's understand why we need them.

### What is a Race Condition?

A race condition occurs when multiple threads access shared data simultaneously, and at least one thread modifies it. The final result depends on the unpredictable timing of thread execution.

**Example of a Race Condition:**

```cpp
#include <iostream>
#include <thread>

int counter = 0;

void incrementCounter() {
    for (int i = 0; i < 100000; ++i) {
        counter++;
    }
}

int main() {
    std::thread t1(incrementCounter);
    std::thread t2(incrementCounter);

    t1.join();
    t2.join();

    std::cout << "Final counter: " << counter << std::endl;

    return 0;
}
```

**What Happens:**

The operation `counter++` looks atomic but actually involves three steps:
1. Read the current value of `counter`
2. Add 1 to it
3. Write the result back to `counter`

When two threads execute these steps simultaneously, they can interleave in unexpected ways:

```
Thread 1: Read counter (0)
Thread 2: Read counter (0)
Thread 1: Add 1 (0 + 1 = 1)
Thread 2: Add 1 (0 + 1 = 1)
Thread 1: Write 1
Thread 2: Write 1
```

Result: Counter is 1, not 2! Both increments read the same initial value.

**Expected Output:** 200,000
**Actual Output:** Anywhere between 100,000 and 200,000 (unpredictable)

This is a race condition, and synchronization primitives solve this problem.

---

## Mutex: Mutual Exclusion

A **mutex** (mutual exclusion) is the most fundamental synchronization primitive. It ensures that only one thread can access a critical section of code at a time.

### Basic Mutex Usage

```cpp
#include <iostream>
#include <thread>
#include <mutex>

int counter = 0;
std::mutex counterMutex;

void incrementCounter() {
    for (int i = 0; i < 100000; ++i) {
        counterMutex.lock();
        counter++;
        counterMutex.unlock();
    }
}

int main() {
    std::thread t1(incrementCounter);
    std::thread t2(incrementCounter);

    t1.join();
    t2.join();

    std::cout << "Final counter: " << counter << std::endl;

    return 0;
}
```

**How It Works:**

When a thread calls `lock()`, it attempts to acquire the mutex. If another thread already holds the mutex, the calling thread blocks (waits) until the mutex becomes available. Once `unlock()` is called, another waiting thread can acquire the mutex.

**Output:** Guaranteed to be 200,000

**Critical Section:** The code between `lock()` and `unlock()` is called the critical section. Only one thread can execute this code at a time.

### The Problem with Manual Lock/Unlock

Manual locking is dangerous because:

1. **Forgetting to unlock** causes deadlock
2. **Exception safety** - if an exception is thrown between lock and unlock, the mutex never gets unlocked
3. **Early returns** can skip the unlock call

```cpp
void dangerousFunction() {
    counterMutex.lock();

    if (someCondition) {
        return;
    }

    counterMutex.unlock();
}
```

If `someCondition` is true, the mutex is never unlocked!

---

## Lock Guard: RAII for Mutexes

`std::lock_guard` is a wrapper that automatically locks a mutex when constructed and unlocks it when destroyed. This follows the RAII (Resource Acquisition Is Initialization) principle.

### Basic Lock Guard

```cpp
#include <iostream>
#include <thread>
#include <mutex>

int counter = 0;
std::mutex counterMutex;

void incrementCounter() {
    for (int i = 0; i < 100000; ++i) {
        std::lock_guard<std::mutex> lock(counterMutex);
        counter++;
    }
}

int main() {
    std::thread t1(incrementCounter);
    std::thread t2(incrementCounter);

    t1.join();
    t2.join();

    std::cout << "Final counter: " << counter << std::endl;

    return 0;
}
```

**How It Works:**

When `lock_guard` is created, it automatically calls `lock()` on the mutex. When the `lock_guard` goes out of scope (at the end of the block or due to an exception), its destructor automatically calls `unlock()`.

**Benefits:**
- **Exception-safe**: Mutex is always unlocked, even if an exception is thrown
- **No forgotten unlocks**: The compiler ensures cleanup
- **Clear scope**: The locked section is visually clear

### Lock Guard with Scope Control

```cpp
#include <iostream>
#include <thread>
#include <mutex>
#include <vector>

std::vector<int> sharedData;
std::mutex dataMutex;

void addData(int value) {
    {
        std::lock_guard<std::mutex> lock(dataMutex);
        sharedData.push_back(value);
        std::cout << "Added: " << value << std::endl;
    }

    std::cout << "Outside critical section" << std::endl;
}

int main() {
    std::thread t1(addData, 1);
    std::thread t2(addData, 2);
    std::thread t3(addData, 3);

    t1.join();
    t2.join();
    t3.join();

    return 0;
}
```

**Key Point:** The inner braces `{}` create a scope. The `lock_guard` is destroyed at the closing brace, releasing the mutex before the second print statement. This minimizes lock contention.

**Output (order may vary):**
```
Added: 1
Outside critical section
Added: 2
Outside critical section
Added: 3
Outside critical section
```

---

## Unique Lock: Flexible Locking

`std::unique_lock` is more flexible than `lock_guard`. It allows:
- Deferred locking
- Manual lock/unlock
- Try-lock operations
- Timed locking
- Transfer of ownership

### Basic Unique Lock

```cpp
#include <iostream>
#include <thread>
#include <mutex>

int counter = 0;
std::mutex counterMutex;

void incrementCounter() {
    for (int i = 0; i < 100000; ++i) {
        std::unique_lock<std::mutex> lock(counterMutex);
        counter++;
    }
}

int main() {
    std::thread t1(incrementCounter);
    std::thread t2(incrementCounter);

    t1.join();
    t2.join();

    std::cout << "Final counter: " << counter << std::endl;

    return 0;
}
```

This example is functionally identical to `lock_guard`, but `unique_lock` offers more control.

### Deferred Locking

```cpp
#include <iostream>
#include <thread>
#include <mutex>

std::mutex m1, m2;

void processData() {
    std::unique_lock<std::mutex> lock1(m1, std::defer_lock);
    std::unique_lock<std::mutex> lock2(m2, std::defer_lock);

    std::lock(lock1, lock2);

    std::cout << "Both mutexes locked" << std::endl;
}

int main() {
    std::thread t1(processData);
    std::thread t2(processData);

    t1.join();
    t2.join();

    return 0;
}
```

**How It Works:**

`std::defer_lock` tells `unique_lock` not to lock the mutex immediately. Instead, we manually lock both mutexes using `std::lock()`, which employs a deadlock-avoidance algorithm.

**Why This Matters:** If thread 1 locks m1 then waits for m2, while thread 2 locks m2 then waits for m1, you have a deadlock. `std::lock()` prevents this.

### Manual Unlock and Relock

```cpp
#include <iostream>
#include <thread>
#include <mutex>

std::mutex dataMutex;

void processInStages() {
    std::unique_lock<std::mutex> lock(dataMutex);

    std::cout << "Stage 1: Critical work" << std::endl;

    lock.unlock();

    std::cout << "Stage 2: Non-critical work (no lock needed)" << std::endl;

    lock.lock();

    std::cout << "Stage 3: Critical work again" << std::endl;
}

int main() {
    std::thread t1(processInStages);
    std::thread t2(processInStages);

    t1.join();
    t2.join();

    return 0;
}
```

**Use Case:** When you have expensive operations that don't need the mutex, unlock it temporarily to improve concurrency.

### Try Lock

```cpp
#include <iostream>
#include <thread>
#include <mutex>
#include <chrono>

std::mutex resourceMutex;

void tryAcquireResource(int threadId) {
    std::unique_lock<std::mutex> lock(resourceMutex, std::defer_lock);

    if (lock.try_lock()) {
        std::cout << "Thread " << threadId << ": Acquired resource" << std::endl;
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
    } else {
        std::cout << "Thread " << threadId << ": Resource busy, doing other work" << std::endl;
    }
}

int main() {
    std::thread t1(tryAcquireResource, 1);
    std::thread t2(tryAcquireResource, 2);
    std::thread t3(tryAcquireResource, 3);

    t1.join();
    t2.join();
    t3.join();

    return 0;
}
```

**How It Works:**

`try_lock()` attempts to acquire the mutex without blocking. If the mutex is available, it returns `true` and locks it. If the mutex is already locked, it returns `false` immediately.

**Use Case:** When you want to avoid blocking and can do alternative work if the resource isn't available.

---

## Shared Mutex: Reader-Writer Lock

A `std::shared_mutex` allows multiple threads to read simultaneously, but only one thread can write at a time. This is also called a reader-writer lock.

### Basic Shared Mutex

```cpp
#include <iostream>
#include <thread>
#include <shared_mutex>
#include <vector>

std::vector<int> data = {1, 2, 3, 4, 5};
std::shared_mutex dataMutex;

void reader(int threadId) {
    std::shared_lock<std::shared_mutex> lock(dataMutex);

    std::cout << "Reader " << threadId << ": ";
    for (int val : data) {
        std::cout << val << " ";
    }
    std::cout << std::endl;
}

void writer(int value) {
    std::unique_lock<std::shared_mutex> lock(dataMutex);

    data.push_back(value);
    std::cout << "Writer: Added " << value << std::endl;
}

int main() {
    std::thread r1(reader, 1);
    std::thread r2(reader, 2);
    std::thread w1(writer, 6);
    std::thread r3(reader, 3);
    std::thread w2(writer, 7);

    r1.join();
    r2.join();
    w1.join();
    r3.join();
    w2.join();

    return 0;
}
```

**How It Works:**

- **Shared Lock** (`shared_lock`): Multiple threads can hold shared locks simultaneously for reading
- **Exclusive Lock** (`unique_lock`): Only one thread can hold an exclusive lock for writing. No other locks (shared or exclusive) can be held at the same time.

**Performance Benefit:**

If you have 100 threads reading and 1 thread writing, regular mutex forces all threads to wait. Shared mutex allows all 100 readers to proceed simultaneously, blocking only when the writer needs access.

### Reader-Writer Pattern Example

```cpp
#include <iostream>
#include <thread>
#include <shared_mutex>
#include <map>
#include <string>
#include <chrono>

class Cache {
private:
    std::map<std::string, int> data;
    mutable std::shared_mutex cacheMutex;

public:
    void write(const std::string& key, int value) {
        std::unique_lock<std::shared_mutex> lock(cacheMutex);
        data[key] = value;
        std::cout << "Wrote: " << key << " = " << value << std::endl;
    }

    bool read(const std::string& key, int& value) const {
        std::shared_lock<std::shared_mutex> lock(cacheMutex);
        auto it = data.find(key);
        if (it != data.end()) {
            value = it->second;
            std::cout << "Read: " << key << " = " << value << std::endl;
            return true;
        }
        return false;
    }
};

int main() {
    Cache cache;

    std::thread writer([&cache]() {
        for (int i = 0; i < 5; ++i) {
            cache.write("key" + std::to_string(i), i * 10);
            std::this_thread::sleep_for(std::chrono::milliseconds(50));
        }
    });

    std::thread reader1([&cache]() {
        for (int i = 0; i < 10; ++i) {
            int value;
            cache.read("key2", value);
            std::this_thread::sleep_for(std::chrono::milliseconds(30));
        }
    });

    std::thread reader2([&cache]() {
        for (int i = 0; i < 10; ++i) {
            int value;
            cache.read("key1", value);
            std::this_thread::sleep_for(std::chrono::milliseconds(30));
        }
    });

    writer.join();
    reader1.join();
    reader2.join();

    return 0;
}
```

**Use Case:** Perfect for caches, configuration data, or any scenario with frequent reads and infrequent writes.

---

## Condition Variables: Thread Coordination

Condition variables allow threads to wait for specific conditions to become true. They're essential for producer-consumer patterns and other coordination scenarios.

### Basic Condition Variable

```cpp
#include <iostream>
#include <thread>
#include <mutex>
#include <condition_variable>
#include <queue>

std::queue<int> dataQueue;
std::mutex queueMutex;
std::condition_variable queueCV;
bool done = false;

void producer() {
    for (int i = 0; i < 10; ++i) {
        std::this_thread::sleep_for(std::chrono::milliseconds(100));

        {
            std::lock_guard<std::mutex> lock(queueMutex);
            dataQueue.push(i);
            std::cout << "Produced: " << i << std::endl;
        }

        queueCV.notify_one();
    }

    {
        std::lock_guard<std::mutex> lock(queueMutex);
        done = true;
    }
    queueCV.notify_all();
}

void consumer(int id) {
    while (true) {
        std::unique_lock<std::mutex> lock(queueMutex);

        queueCV.wait(lock, []{ return !dataQueue.empty() || done; });

        if (dataQueue.empty() && done) {
            break;
        }

        if (!dataQueue.empty()) {
            int value = dataQueue.front();
            dataQueue.pop();
            lock.unlock();

            std::cout << "Consumer " << id << " consumed: " << value << std::endl;
        }
    }
}

int main() {
    std::thread prod(producer);
    std::thread cons1(consumer, 1);
    std::thread cons2(consumer, 2);

    prod.join();
    cons1.join();
    cons2.join();

    return 0;
}
```

**How It Works:**

1. **Producer** creates data, adds it to the queue, and calls `notify_one()` to wake up one waiting consumer
2. **Consumer** calls `wait()` with a predicate (lambda function). The thread sleeps until:
   - Another thread calls `notify_one()` or `notify_all()`, AND
   - The predicate returns true
3. The condition variable automatically unlocks the mutex while waiting and relocks it when awakened

**Why the Predicate?** Spurious wakeups can occur (thread wakes up without notification). The predicate ensures the condition is actually true.

### Producer-Consumer with Bounded Queue

```cpp
#include <iostream>
#include <thread>
#include <mutex>
#include <condition_variable>
#include <queue>

const int MAX_QUEUE_SIZE = 5;

std::queue<int> dataQueue;
std::mutex queueMutex;
std::condition_variable notFull;
std::condition_variable notEmpty;
bool done = false;

void producer() {
    for (int i = 0; i < 20; ++i) {
        std::unique_lock<std::mutex> lock(queueMutex);

        notFull.wait(lock, []{ return dataQueue.size() < MAX_QUEUE_SIZE; });

        dataQueue.push(i);
        std::cout << "Produced: " << i << " (Queue size: " << dataQueue.size() << ")" << std::endl;

        lock.unlock();
        notEmpty.notify_one();

        std::this_thread::sleep_for(std::chrono::milliseconds(50));
    }

    {
        std::lock_guard<std::mutex> lock(queueMutex);
        done = true;
    }
    notEmpty.notify_all();
}

void consumer(int id) {
    while (true) {
        std::unique_lock<std::mutex> lock(queueMutex);

        notEmpty.wait(lock, []{ return !dataQueue.empty() || done; });

        if (dataQueue.empty() && done) {
            break;
        }

        int value = dataQueue.front();
        dataQueue.pop();
        std::cout << "Consumer " << id << " consumed: " << value << " (Queue size: " << dataQueue.size() << ")" << std::endl;

        lock.unlock();
        notFull.notify_one();

        std::this_thread::sleep_for(std::chrono::milliseconds(150));
    }
}

int main() {
    std::thread prod(producer);
    std::thread cons1(consumer, 1);
    std::thread cons2(consumer, 2);

    prod.join();
    cons1.join();
    cons2.join();

    return 0;
}
```

**How It Works:**

- Producer waits if queue is full (using `notFull` condition variable)
- Consumer waits if queue is empty (using `notEmpty` condition variable)
- Each notifies the other after adding/removing items

**Use Case:** This pattern is fundamental in concurrent systems like thread pools, message queues, and task schedulers.

---

## Semaphores (C++20)

A semaphore is a synchronization primitive that maintains a count. Threads can acquire (decrement) or release (increment) the count. If a thread tries to acquire when count is zero, it blocks until another thread releases.

### Counting Semaphore

```cpp
#include <iostream>
#include <thread>
#include <semaphore>
#include <vector>
#include <chrono>

std::counting_semaphore<3> resourcePool(3);

void useResource(int threadId) {
    std::cout << "Thread " << threadId << " waiting for resource..." << std::endl;

    resourcePool.acquire();

    std::cout << "Thread " << threadId << " acquired resource" << std::endl;
    std::this_thread::sleep_for(std::chrono::seconds(2));
    std::cout << "Thread " << threadId << " releasing resource" << std::endl;

    resourcePool.release();
}

int main() {
    std::vector<std::thread> threads;

    for (int i = 0; i < 10; ++i) {
        threads.emplace_back(useResource, i);
    }

    for (auto& t : threads) {
        t.join();
    }

    return 0;
}
```

**How It Works:**

The semaphore is initialized with count 3, meaning up to 3 threads can hold the resource simultaneously. When a thread calls `acquire()`:
- If count > 0, decrement count and proceed
- If count == 0, block until another thread calls `release()`

**Use Case:** Limiting concurrent access to a resource pool (database connections, file handles, etc.)

### Binary Semaphore (Signal/Wait)

```cpp
#include <iostream>
#include <thread>
#include <semaphore>

std::binary_semaphore signal(0);

void waiter() {
    std::cout << "Waiter: Waiting for signal..." << std::endl;
    signal.acquire();
    std::cout << "Waiter: Received signal, proceeding!" << std::endl;
}

void signaler() {
    std::this_thread::sleep_for(std::chrono::seconds(2));
    std::cout << "Signaler: Sending signal..." << std::endl;
    signal.release();
}

int main() {
    std::thread t1(waiter);
    std::thread t2(signaler);

    t1.join();
    t2.join();

    return 0;
}
```

**How It Works:**

Binary semaphore is initialized with 0. The waiter blocks on `acquire()` until the signaler calls `release()`, which sets the count to 1.

**Use Case:** Signaling between threads (similar to condition variables but simpler for basic signaling).

---

## Latches (C++20)

A latch is a single-use countdown synchronization primitive. Threads can wait for the counter to reach zero. Once it reaches zero, all waiting threads proceed and the latch cannot be reused.

### Basic Latch

```cpp
#include <iostream>
#include <thread>
#include <latch>
#include <vector>

std::latch workersReady(3);
std::latch workComplete(3);

void worker(int id) {
    std::cout << "Worker " << id << " initializing..." << std::endl;
    std::this_thread::sleep_for(std::chrono::milliseconds(id * 100));

    std::cout << "Worker " << id << " ready" << std::endl;
    workersReady.count_down();

    workersReady.wait();

    std::cout << "Worker " << id << " starting work" << std::endl;
    std::this_thread::sleep_for(std::chrono::milliseconds(500));
    std::cout << "Worker " << id << " finished work" << std::endl;

    workComplete.count_down();
}

int main() {
    std::cout << "Starting workers..." << std::endl;

    std::vector<std::thread> workers;
    for (int i = 0; i < 3; ++i) {
        workers.emplace_back(worker, i);
    }

    workComplete.wait();
    std::cout << "All workers finished!" << std::endl;

    for (auto& t : workers) {
        t.join();
    }

    return 0;
}
```

**How It Works:**

1. Each worker initializes and calls `count_down()` on `workersReady`
2. Workers wait on `workersReady.wait()` until all have called `count_down()`
3. Once count reaches zero, all workers proceed simultaneously
4. Workers complete their work and count down `workComplete`
5. Main thread waits for `workComplete` to reach zero

**Use Case:** Synchronizing initialization or waiting for multiple tasks to complete before proceeding.

### Arrive and Wait Pattern

```cpp
#include <iostream>
#include <thread>
#include <latch>
#include <vector>

void parallelTask(int id, std::latch& sync) {
    std::cout << "Task " << id << " executing phase 1" << std::endl;
    std::this_thread::sleep_for(std::chrono::milliseconds(id * 100));

    sync.arrive_and_wait();

    std::cout << "Task " << id << " executing phase 2" << std::endl;
    std::this_thread::sleep_for(std::chrono::milliseconds(id * 50));
}

int main() {
    const int numTasks = 5;
    std::latch phaseSync(numTasks);

    std::vector<std::thread> tasks;
    for (int i = 0; i < numTasks; ++i) {
        tasks.emplace_back(parallelTask, i, std::ref(phaseSync));
    }

    for (auto& t : tasks) {
        t.join();
    }

    return 0;
}
```

**How It Works:**

`arrive_and_wait()` combines `count_down()` and `wait()` in one atomic operation. All threads wait at the synchronization point until all have arrived.

**Use Case:** Multi-phase algorithms where all threads must complete one phase before any can start the next (parallel merge sort, barrier synchronization in simulations).

---

## Barriers (C++20)

A barrier is a reusable synchronization point. Unlike latch, a barrier can be used multiple times. Threads arrive at the barrier and wait for all others to arrive before proceeding to the next phase.

### Basic Barrier

```cpp
#include <iostream>
#include <thread>
#include <barrier>
#include <vector>

void worker(int id, std::barrier<>& sync, int phases) {
    for (int phase = 0; phase < phases; ++phase) {
        std::cout << "Worker " << id << " phase " << phase << std::endl;
        std::this_thread::sleep_for(std::chrono::milliseconds(id * 100));

        sync.arrive_and_wait();

        std::cout << "Worker " << id << " continuing to next phase" << std::endl;
    }
}

int main() {
    const int numWorkers = 4;
    const int numPhases = 3;

    std::barrier sync(numWorkers);

    std::vector<std::thread> workers;
    for (int i = 0; i < numWorkers; ++i) {
        workers.emplace_back(worker, i, std::ref(sync), numPhases);
    }

    for (auto& t : workers) {
        t.join();
    }

    return 0;
}
```

**How It Works:**

The barrier maintains a counter. When a thread calls `arrive_and_wait()`:
1. Counter is decremented
2. If counter > 0, thread blocks
3. If counter == 0, all threads are released and counter resets to initial value

**Difference from Latch:** Barrier resets and can be used multiple times. Latch is single-use.

### Barrier with Completion Function

```cpp
#include <iostream>
#include <thread>
#include <barrier>
#include <vector>
#include <atomic>

std::atomic<int> phaseCounter{0};

void onPhaseComplete() {
    std::cout << "=== Phase " << phaseCounter++ << " completed by all threads ===" << std::endl;
}

void simulationWorker(int id, std::barrier<std::function<void()>>& sync, int iterations) {
    for (int i = 0; i < iterations; ++i) {
        std::cout << "Thread " << id << " computing iteration " << i << std::endl;
        std::this_thread::sleep_for(std::chrono::milliseconds(100));

        sync.arrive_and_wait();
    }
}

int main() {
    const int numThreads = 3;
    const int numIterations = 4;

    std::barrier sync(numThreads, onPhaseComplete);

    std::vector<std::thread> threads;
    for (int i = 0; i < numThreads; ++i) {
        threads.emplace_back(simulationWorker, i, std::ref(sync), numIterations);
    }

    for (auto& t : threads) {
        t.join();
    }

    return 0;
}
```

**How It Works:**

The completion function is called exactly once each time all threads reach the barrier, before any threads are released. This happens on one arbitrary thread.

**Use Case:** Perfect for iterative algorithms like:
- Parallel simulations (physics, game of life)
- Iterative numerical methods
- Bulk synchronous parallel (BSP) algorithms

---

## Atomic Operations

Atomic operations are operations that complete without interruption. They're lock-free and much faster than mutexes for simple operations.

### Basic Atomic Counter

```cpp
#include <iostream>
#include <thread>
#include <atomic>
#include <vector>

std::atomic<int> counter{0};

void incrementCounter() {
    for (int i = 0; i < 100000; ++i) {
        counter.fetch_add(1);
    }
}

int main() {
    std::vector<std::thread> threads;

    for (int i = 0; i < 10; ++i) {
        threads.emplace_back(incrementCounter);
    }

    for (auto& t : threads) {
        t.join();
    }

    std::cout << "Final counter: " << counter << std::endl;

    return 0;
}
```

**How It Works:**

`fetch_add(1)` atomically reads the current value, adds 1, and stores it back. This happens as a single, uninterruptible operation at the hardware level.

**Output:** Guaranteed to be 1,000,000

**Performance:** Atomic operations are orders of magnitude faster than mutex operations because they don't involve kernel calls or context switches.

### Atomic Compare-Exchange

```cpp
#include <iostream>
#include <thread>
#include <atomic>

std::atomic<int> value{0};

void tryUpdate(int threadId, int newValue) {
    int expected = threadId - 1;

    bool success = value.compare_exchange_strong(expected, newValue);

    if (success) {
        std::cout << "Thread " << threadId << " successfully updated value to " << newValue << std::endl;
    } else {
        std::cout << "Thread " << threadId << " failed. Expected " << (threadId - 1)
                  << " but found " << expected << std::endl;
    }
}

int main() {
    std::thread t1(tryUpdate, 1, 1);
    std::thread t2(tryUpdate, 2, 2);
    std::thread t3(tryUpdate, 3, 3);

    t1.join();
    t2.join();
    t3.join();

    std::cout << "Final value: " << value << std::endl;

    return 0;
}
```

**How It Works:**

`compare_exchange_strong(expected, desired)` atomically:
1. Compares the atomic value with `expected`
2. If equal, stores `desired` and returns true
3. If not equal, loads the actual value into `expected` and returns false

**Use Case:** Building lock-free data structures, implementing spinlocks, optimistic concurrency control.

### Atomic Flag (Spinlock)

```cpp
#include <iostream>
#include <thread>
#include <atomic>

class Spinlock {
private:
    std::atomic_flag flag = ATOMIC_FLAG_INIT;

public:
    void lock() {
        while (flag.test_and_set(std::memory_order_acquire)) {
        }
    }

    void unlock() {
        flag.clear(std::memory_order_release);
    }
};

Spinlock spinlock;
int counter = 0;

void incrementWithSpinlock() {
    for (int i = 0; i < 100000; ++i) {
        spinlock.lock();
        counter++;
        spinlock.unlock();
    }
}

int main() {
    std::thread t1(incrementWithSpinlock);
    std::thread t2(incrementWithSpinlock);

    t1.join();
    t2.join();

    std::cout << "Final counter: " << counter << std::endl;

    return 0;
}
```

**How It Works:**

`test_and_set()` atomically sets the flag to true and returns the previous value. If it was already true, the thread spins (busy-waits) in the while loop until another thread clears the flag.

**When to Use Spinlocks:** Only when critical sections are extremely short (a few instructions). For longer critical sections, use mutexes because spinlocks waste CPU cycles.

---

## Memory Ordering

Atomic operations can specify memory ordering constraints that control how memory operations are reordered by the compiler and CPU.

### Memory Order Types

```cpp
#include <iostream>
#include <thread>
#include <atomic>

std::atomic<bool> dataReady{false};
std::atomic<int> data{0};

void producer() {
    data.store(42, std::memory_order_relaxed);
    dataReady.store(true, std::memory_order_release);
}

void consumer() {
    while (!dataReady.load(std::memory_order_acquire)) {
    }

    std::cout << "Data: " << data.load(std::memory_order_relaxed) << std::endl;
}

int main() {
    std::thread t1(producer);
    std::thread t2(consumer);

    t1.join();
    t2.join();

    return 0;
}
```

**Memory Order Semantics:**

1. **memory_order_relaxed**: No synchronization or ordering constraints. Only atomicity is guaranteed.

2. **memory_order_acquire**: Load operation. Prevents memory reordering of subsequent reads/writes before this load.

3. **memory_order_release**: Store operation. Prevents memory reordering of prior reads/writes after this store.

4. **memory_order_acq_rel**: Both acquire and release semantics.

5. **memory_order_seq_cst**: Sequential consistency. Strongest ordering, default for atomics.

**How It Works:**

Release-acquire ensures that:
- All writes before the release store are visible to threads that perform an acquire load
- The consumer sees `data = 42` before checking `dataReady`

**Use Case:** Building lock-free data structures where you need to carefully control visibility of memory operations across threads.

### Sequential Consistency Example

```cpp
#include <iostream>
#include <thread>
#include <atomic>

std::atomic<int> x{0};
std::atomic<int> y{0};
int r1, r2;

void thread1() {
    x.store(1, std::memory_order_seq_cst);
    r1 = y.load(std::memory_order_seq_cst);
}

void thread2() {
    y.store(1, std::memory_order_seq_cst);
    r2 = x.load(std::memory_order_seq_cst);
}

int main() {
    std::thread t1(thread1);
    std::thread t2(thread2);

    t1.join();
    t2.join();

    std::cout << "r1: " << r1 << ", r2: " << r2 << std::endl;

    return 0;
}
```

**Possible Outputs:**
- r1 = 0, r2 = 1
- r1 = 1, r2 = 0
- r1 = 1, r2 = 1

**Impossible Output:** r1 = 0, r2 = 0 (with sequential consistency)

Sequential consistency ensures a global order of operations. At least one thread must observe the other's store.

---

## Practical Example: Thread Pool

Let's build a complete thread pool using synchronization primitives.

```cpp
#include <iostream>
#include <thread>
#include <vector>
#include <queue>
#include <functional>
#include <mutex>
#include <condition_variable>

class ThreadPool {
private:
    std::vector<std::thread> workers;
    std::queue<std::function<void()>> tasks;
    std::mutex queueMutex;
    std::condition_variable condition;
    bool stop;

public:
    ThreadPool(size_t numThreads) : stop(false) {
        for (size_t i = 0; i < numThreads; ++i) {
            workers.emplace_back([this] {
                while (true) {
                    std::function<void()> task;

                    {
                        std::unique_lock<std::mutex> lock(queueMutex);

                        condition.wait(lock, [this] {
                            return stop || !tasks.empty();
                        });

                        if (stop && tasks.empty()) {
                            return;
                        }

                        task = std::move(tasks.front());
                        tasks.pop();
                    }

                    task();
                }
            });
        }
    }

    template<class F>
    void enqueue(F&& f) {
        {
            std::unique_lock<std::mutex> lock(queueMutex);
            tasks.emplace(std::forward<F>(f));
        }
        condition.notify_one();
    }

    ~ThreadPool() {
        {
            std::unique_lock<std::mutex> lock(queueMutex);
            stop = true;
        }

        condition.notify_all();

        for (std::thread& worker : workers) {
            worker.join();
        }
    }
};

int main() {
    ThreadPool pool(4);

    for (int i = 0; i < 10; ++i) {
        pool.enqueue([i] {
            std::cout << "Task " << i << " executing on thread "
                      << std::this_thread::get_id() << std::endl;
            std::this_thread::sleep_for(std::chrono::milliseconds(100));
            std::cout << "Task " << i << " complete" << std::endl;
        });
    }

    std::this_thread::sleep_for(std::chrono::seconds(2));

    return 0;
}
```

**How It Works:**

1. **Constructor** creates worker threads that wait for tasks
2. **Worker Loop** waits on condition variable for tasks or stop signal
3. **enqueue()** adds tasks to queue and notifies one waiting worker
4. **Destructor** sets stop flag, notifies all workers, and joins them

**Synchronization Used:**
- Mutex protects the task queue
- Condition variable coordinates task availability
- Unique lock for flexible lock management

---

## Best Practices

### 1. Minimize Critical Sections

```cpp
void bad() {
    std::lock_guard<std::mutex> lock(mutex);

    expensiveComputation();
    quickUpdate();
}

void good() {
    int result = expensiveComputation();

    std::lock_guard<std::mutex> lock(mutex);
    quickUpdate();
}
```

Keep locks held for the shortest time possible. Do expensive work outside critical sections.

### 2. Lock Ordering

```cpp
std::mutex m1, m2;

void thread1() {
    std::scoped_lock lock(m1, m2);
}

void thread2() {
    std::scoped_lock lock(m1, m2);
}
```

Always acquire multiple locks in the same order across all threads. Use `std::scoped_lock` for deadlock-free multi-mutex locking.

### 3. Prefer RAII Locks

```cpp
void bad() {
    mutex.lock();
    doWork();
    mutex.unlock();
}

void good() {
    std::lock_guard<std::mutex> lock(mutex);
    doWork();
}
```

RAII locks ensure unlocking even with exceptions or early returns.

### 4. Use Appropriate Synchronization

| Scenario | Best Choice |
|----------|-------------|
| Simple counter | `std::atomic` |
| Protecting data structure | `std::mutex` + `lock_guard` |
| Flexible locking | `std::unique_lock` |
| Many readers, few writers | `std::shared_mutex` |
| Thread coordination | `std::condition_variable` |
| Resource pool | `std::counting_semaphore` |
| Phase synchronization | `std::barrier` |
| One-time synchronization | `std::latch` |

### 5. Avoid Deadlocks

**Deadlock occurs when:**
1. Mutual exclusion (locks are exclusive)
2. Hold and wait (thread holds lock while waiting for another)
3. No preemption (can't force unlock)
4. Circular wait (thread A waits for B, B waits for A)

**Prevention strategies:**
- Lock ordering
- Try-lock with timeout
- Use `std::scoped_lock` for multiple mutexes
- Avoid calling unknown code while holding locks

---

## Performance Considerations

### Lock Contention

```cpp
#include <iostream>
#include <thread>
#include <mutex>
#include <atomic>
#include <chrono>
#include <vector>

std::mutex counterMutex;
int mutexCounter = 0;

std::atomic<int> atomicCounter{0};

void incrementWithMutex(int iterations) {
    for (int i = 0; i < iterations; ++i) {
        std::lock_guard<std::mutex> lock(counterMutex);
        mutexCounter++;
    }
}

void incrementWithAtomic(int iterations) {
    for (int i = 0; i < iterations; ++i) {
        atomicCounter.fetch_add(1);
    }
}

int main() {
    const int iterations = 1000000;
    const int numThreads = 4;

    auto start = std::chrono::high_resolution_clock::now();
    {
        std::vector<std::thread> threads;
        for (int i = 0; i < numThreads; ++i) {
            threads.emplace_back(incrementWithMutex, iterations);
        }
        for (auto& t : threads) {
            t.join();
        }
    }
    auto mutexTime = std::chrono::high_resolution_clock::now() - start;

    start = std::chrono::high_resolution_clock::now();
    {
        std::vector<std::thread> threads;
        for (int i = 0; i < numThreads; ++i) {
            threads.emplace_back(incrementWithAtomic, iterations);
        }
        for (auto& t : threads) {
            t.join();
        }
    }
    auto atomicTime = std::chrono::high_resolution_clock::now() - start;

    std::cout << "Mutex time: "
              << std::chrono::duration_cast<std::chrono::milliseconds>(mutexTime).count()
              << " ms" << std::endl;
    std::cout << "Atomic time: "
              << std::chrono::duration_cast<std::chrono::milliseconds>(atomicTime).count()
              << " ms" << std::endl;

    std::cout << "Mutex counter: " << mutexCounter << std::endl;
    std::cout << "Atomic counter: " << atomicCounter << std::endl;

    return 0;
}
```

**Typical Results:** Atomics are 5-10x faster than mutexes for simple operations due to:
- No kernel mode transitions
- No thread blocking/waking
- Hardware-level synchronization

---

## Conclusion

C++ provides a rich set of synchronization primitives for concurrent programming:

- **Mutex** for basic mutual exclusion
- **Lock Guards** for RAII-style locking
- **Unique Locks** for flexible lock management
- **Shared Mutex** for reader-writer scenarios
- **Condition Variables** for thread coordination
- **Semaphores** for resource counting
- **Latches** for one-time synchronization
- **Barriers** for reusable phase synchronization
- **Atomics** for lock-free operations

Choose the right primitive based on your use case. Start with the simplest solution (often `std::lock_guard` with `std::mutex`), and only move to more complex primitives when you have a specific need.

The key to correct concurrent programming is understanding these primitives deeply and using them to build higher-level abstractions that encapsulate the complexity of synchronization.
