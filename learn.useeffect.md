# Understanding useEffect Hook - A Complete Guide for Beginners

## What is useEffect?

`useEffect` is a React Hook that lets you perform side effects in function components. Think of it as a way to tell React: "After you finish rendering the screen, I want to do something extra."

## When to use useEffect?

You need useEffect for:
1. **Fetching data** from an API or database
2. **Setting up subscriptions** (like WebSocket connections)
3. **Manually changing the DOM** (outside of React's normal flow)
4. **Setting up timers** (setTimeout, setInterval)
5. **Logging** or analytics

## Basic Syntax

```javascript
import { useEffect, useState } from 'react';

function MyComponent() {
  useEffect(() => {
    // This code runs after the component renders
    console.log('Component rendered!');
  }, []); // Empty array = run only once when component mounts

  return <div>Hello</div>;
}
```

## The Dependency Array - The Key Concept

The second argument to useEffect is the **dependency array**. It tells useEffect "when to re-run this effect."

```javascript
useEffect(() => {
  // code to run
}, [dependency1, dependency2]);
```

| Scenario | What to put in array | When it runs |
|----------|---------------------|--------------|
| Run once on mount | `[]` (empty array) | Only when component first appears |
| Run when something changes | `[variableName]` | Every time that variable changes |
| Run every render | Nothing (remove array) | After EVERY render |
| Run when multiple things change | `[a, b, c]` | When ANY of a, b, or c changes |

## Examples for Every Scenario

### Example 1: Run Once on Mount (Fetching Data)

```javascript
import { useState, useEffect } from 'react';
import { supabase } from './supabase';

function UserList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // ✅ CORRECT: Declare function BEFORE useEffect in React 19
  const fetchUsers = async () => {
    const { data } = await supabase.from('users').select('*');
    setUsers(data || []);
    setLoading(false);
  };

  // This runs ONCE when the component mounts
  useEffect(() => {
    fetchUsers();
  }, []); // Empty array = run only once

  if (loading) return <div>Loading...</div>;

  return (
    <ul>
      {users.map(user => <li key={user.id}>{user.name}</li>)}
    </ul>
  );
}
```

### Example 2: Run When State Changes

```javascript
function SearchResults() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  // This runs EVERY TIME 'query' changes
  useEffect(() => {
    const search = async () => {
      if (query.length < 3) {
        setResults([]);
        return;
      }
      const { data } = await supabase
        .from('products')
        .select('*')
        .ilike('name', `%${query}%`);
      setResults(data || []);
    };

    const timeoutId = setTimeout(search, 300); // Debounce

    // Cleanup function - runs before the next effect
    return () => clearTimeout(timeoutId);
  }, [query]); // Re-run when query changes

  return (
    <div>
      <input 
        value={query} 
        onChange={e => setQuery(e.target.value)} 
      />
      {results.map(r => <div key={r.id}>{r.name}</div>)}
    </div>
  );
}
```

### Example 3: Cleanup Function (Very Important!)

```javascript
function OnlineUsers() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    // Subscribe to real-time updates
    const channel = supabase
      .channel('users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, 
        (payload) => {
          console.log('Change received!', payload);
        }
      )
      .subscribe();

    // CLEANUP: Unsubscribe when component unmounts
    return () => {
      supabase.removeChannel(channel);
    };
  }, []); // Run once on mount

  return <div>Listening for changes...</div>;
}
```

## The Golden Rule: Order Matters! ⚠️

### ❌ WRONG - Will Cause "Cannot access 'X' before initialization"

```javascript
function MyComponent() {
  const [data, setData] = useState([]);

  // ERROR: Using loadData before it's declared!
  useEffect(() => {
    loadData();
  }, []);

  // PROBLEM: This comes AFTER the useEffect that uses it
  const loadData = async () => {
    const { data } = await supabase.from('items').select('*');
    setData(data || []);
  };

  return <div>{data.length}</div>;
}
```

### ✅ CORRECT - Declare Functions Before Using Them

```javascript
function MyComponent() {
  const [data, setData] = useState([]);

  // CORRECT: Function is declared BEFORE useEffect
  const loadData = async () => {
    const { data } = await supabase.from('items').select('*');
    setData(data || []);
  };

  // Now this works fine!
  useEffect(() => {
    loadData();
  }, []);

  return <div>{data.length}</div>;
}
```

### Alternative: Define Inside useEffect

```javascript
function MyComponent() {
  const [data, setData] = useState([]);

  // Define the function INSIDE useEffect
  useEffect(() => {
    const loadData = async () => {
      const { data } = await supabase.from('items').select('*');
      setData(data || []);
    };
    
    loadData();
  }, []);

  return <div>{data.length}</div>;
}
```

## Common Mistakes to Avoid

### Mistake 1: Missing Dependency

```javascript
// ❌ WRONG - 'searchTerm' is used but not in dependency array
useEffect(() => {
  const results = items.filter(item => 
    item.name.includes(searchTerm)
  );
  setFiltered(results);
}, []); // Missing searchTerm!

// ✅ CORRECT
useEffect(() => {
  const results = items.filter(item => 
    item.name.includes(searchTerm)
  );
  setFiltered(results);
}, [searchTerm, items]);
```

### Mistake 2: Too Many Dependencies (Infinite Loop)

```javascript
// ❌ WRONG - setData in dependency causes infinite loop!
useEffect(() => {
  fetchData().then(data => setData(data));
}, [data]); // This triggers when data changes, causing another fetch!

// ✅ CORRECT - Use empty array for one-time fetch
useEffect(() => {
  fetchData().then(data => setData(data));
}, []);
```

### Mistake 3: Using Object/Array in Dependency

```javascript
// ❌ WRONG - {} creates new reference every render!
useEffect(() => {
  doSomething(options);
}, [options]); // options is a new object each render!

// ✅ CORRECT - Use primitive values or useMemo
useEffect(() => {
  doSomething(options.name, options.value);
}, [options.name, options.value]);
```

## Understanding the Cleanup Function

The cleanup function runs:
1. **Before** the effect runs again (to clean up the previous run)
2. **When** the component unmounts (disappears from screen)

```javascript
useEffect(() => {
  const timer = setInterval(() => {
    console.log('Tick!');
  }, 1000);

  // Cleanup: Clear timer when component unmounts
  // or before the effect runs again
  return () => {
    clearInterval(timer);
  };
}, []);
```

## Quick Reference Cheat Sheet

```javascript
// 1. Run once on mount (most common for API calls)
useEffect(() => {
  // Your code here
}, []);

// 2. Run when 'count' changes
useEffect(() => {
  // Your code here
}, [count]);

// 3. Run on every render (rarely needed)
useEffect(() => {
  // Your code here
});

// 4. Run when 'a' OR 'b' changes
useEffect(() => {
  // Your code here
}, [a, b]);

// 5. With cleanup
useEffect(() => {
  // Setup code
  return () => {
    // Cleanup code
  };
}, [dependencies]);
```

## Summary

1. **useEffect** = "Do this after rendering"
2. **Dependency array** = "Re-run when these values change"
3. **Empty array** = "Run once when component mounts"
4. **Order matters** = Declare functions/variables BEFORE using them in useEffect
5. **Cleanup** = Return a function to clean up (timers, subscriptions, etc.)

Remember: In React 19, always declare your helper functions BEFORE the useEffect that uses them to avoid "Cannot access 'X' before initialization" errors!
