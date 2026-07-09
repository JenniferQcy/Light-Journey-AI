'use client'

import { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export function Input({ label, error, leftIcon, rightIcon, className = '', ...props }: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-text-secondary mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary">
            {leftIcon}
          </div>
        )}
        <input
          className={`w-full px-4 py-3 bg-surface-secondary rounded-xl text-text-primary placeholder:text-text-tertiary outline-none focus:ring-2 focus:ring-primary-500/20 focus:bg-white transition-all duration-200 ease-ios ${leftIcon ? 'pl-11' : ''} ${rightIcon ? 'pr-11' : ''} ${error ? 'ring-2 ring-error/20 bg-red-50' : ''} ${className}`}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-text-tertiary">
            {rightIcon}
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-sm text-error">{error}</p>}
    </div>
  )
}

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export function TextArea({ label, error, className = '', ...props }: TextAreaProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-text-secondary mb-2">
          {label}
        </label>
      )}
      <textarea
        className={`w-full px-4 py-3 bg-surface-secondary rounded-xl text-text-primary placeholder:text-text-tertiary outline-none focus:ring-2 focus:ring-primary-500/20 focus:bg-white transition-all duration-200 ease-ios resize-none ${error ? 'ring-2 ring-error/20 bg-red-50' : ''} ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-error">{error}</p>}
    </div>
  )
}
