"use client";

import React, { useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';

export interface FormSchema {
  fields: {
    name: string;
    label: string;
    type: 'text' | 'number' | 'select' | 'boolean' | 'password';
    required?: boolean;
    options?: { label: string; value: string | number }[];
    defaultValue?: any;
  }[];
  submitLabel?: string;
}

export function DynamicForm({ schema, onSubmit, initialValues = {} }: { schema: FormSchema, onSubmit: (data: any) => void, initialValues?: any }) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<Record<string, any>>(() => {
    const init: Record<string, any> = { ...initialValues };
    schema.fields.forEach(f => {
      if (init[f.name] === undefined && f.defaultValue !== undefined) {
        init[f.name] = f.defaultValue;
      }
    });
    return init;
  });

  const handleChange = (name: string, value: any) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {schema.fields.map((field) => (
        <div key={field.name} className="flex flex-col gap-1.5">
          <label className="text-sm font-bold text-gray-300">
            {t(field.label)} {field.required && <span className="text-red-500">*</span>}
          </label>
          
          {field.type === 'text' || field.type === 'number' || field.type === 'password' ? (
            <input
              type={field.type}
              required={field.required}
              value={formData[field.name] || ''}
              onChange={(e) => handleChange(field.name, field.type === 'number' ? Number(e.target.value) : e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
            />
          ) : field.type === 'select' ? (
            <select
              required={field.required}
              value={formData[field.name] || ''}
              onChange={(e) => handleChange(field.name, e.target.value)}
              className="bg-[#0f1523] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
            >
              <option value="" disabled>{t('select_option')}</option>
              {field.options?.map(opt => (
                <option key={opt.value} value={opt.value}>{t(opt.label)}</option>
              ))}
            </select>
          ) : field.type === 'boolean' ? (
            <label className="relative inline-flex items-center cursor-pointer mt-1">
              <input 
                type="checkbox" 
                className="sr-only peer"
                checked={!!formData[field.name]}
                onChange={(e) => handleChange(field.name, e.target.checked)}
              />
              <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
            </label>
          ) : null}
        </div>
      ))}

      <button 
        type="submit"
        className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)] mt-4"
      >
        {t(schema.submitLabel || 'submit')}
      </button>
    </form>
  );
}
