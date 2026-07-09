'use client'

interface TagSelectorProps {
  options: { value: string; label: string }[]
  value: string[]
  onChange: (value: string[]) => void
  multiple?: boolean
}

export default function TagSelector({ options, value, onChange, multiple = true }: TagSelectorProps) {
  const handleToggle = (optionValue: string) => {
    if (multiple) {
      if (value.includes(optionValue)) {
        onChange(value.filter((v) => v !== optionValue))
      } else {
        onChange([...value, optionValue])
      }
    } else {
      onChange(value.includes(optionValue) ? [] : [optionValue])
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isSelected = value.includes(option.value)
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => handleToggle(option.value)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ease-ios ${
              isSelected
                ? 'bg-primary-500 text-white shadow-sm shadow-primary-500/30'
                : 'bg-surface-secondary text-text-secondary active:bg-surface-tertiary'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
