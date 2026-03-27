import { useState, useEffect } from 'react';

type TodoItem = {
  id: string
  title: string
  status: 'pending' | 'completed' | string
}
import { supabase } from '../supabase';

export default function TodoList() {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [newTodo, setNewTodo] = useState('');
  useEffect(() => { supabase.from('todos').select('*').order('created_at', { ascending: false }).then(({ data }) => setTodos(data || [])); }, []);
  const addTodo = async () => { if (!newTodo.trim()) return; await supabase.from('todos').insert({ title: newTodo, status: 'pending' }); setNewTodo(''); supabase.from('todos').select('*').order('created_at', { ascending: false }).then(({ data }) => setTodos(data || [])); };
  const toggleTodo = async (id: string, status: string) => { await supabase.from('todos').update({ status: status === 'pending' ? 'completed' : 'pending' }).eq('id', id); supabase.from('todos').select('*').order('created_at', { ascending: false }).then(({ data }) => setTodos(data || [])); };
  const deleteTodo = async (id: string) => { await supabase.from('todos').delete().eq('id', id); supabase.from('todos').select('*').order('created_at', { ascending: false }).then(({ data }) => setTodos(data || [])); };
  return (
    <div>
      <div className="page-header"><h1 className="page-title">To Do List</h1></div>
      <div className="card">
        <div className="todo-input-container">
          <input 
            type="text" 
            className="todo-input" 
            value={newTodo} 
            onChange={e => setNewTodo(e.target.value)} 
            placeholder="Add a new task..." 
            onKeyPress={e => e.key === 'Enter' && addTodo()}
          />
          <button className="btn btn-primary" onClick={addTodo}>Add Task</button>
        </div>
        {todos.length === 0 ? (
          <div className="empty-state">
            <h3>No tasks yet</h3>
            <p>Add your first task above</p>
          </div>
        ) : (
          <div className="todo-list">
            {todos.map(todo => (
              <div key={todo.id} className="todo-item">
                <div 
                  className={`todo-checkbox ${todo.status === 'completed' ? 'checked' : ''}`}
                  onClick={() => toggleTodo(todo.id, todo.status)}
                >
                  {todo.status === 'completed' && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </div>
                <span className={`todo-text ${todo.status === 'completed' ? 'completed' : ''}`}>
                  {todo.title}
                </span>
                <button className="todo-delete" onClick={() => deleteTodo(todo.id)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


