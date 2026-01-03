import React from 'react';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MuiSelect from '@mui/material/Select';
import FormHelperText from '@mui/material/FormHelperText';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
  size?: 'small' | 'medium';
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  fullWidth = true,
  size = 'medium',
  required,
  value,
  onChange,
  placeholder,
  disabled,
  name,
  type,
}) => {
  return (
    <TextField
      label={label}
      error={!!error}
      helperText={error || helperText}
      fullWidth={fullWidth}
      size={size}
      required={required}
      variant="outlined"
      value={value}
      onChange={onChange as unknown as React.ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>}
      placeholder={placeholder}
      disabled={disabled}
      name={name}
      type={type}
      sx={{
        '& .MuiOutlinedInput-root': {
          borderRadius: 2,
        },
      }}
    />
  );
};

interface TextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
  rows?: number;
}

export const Textarea: React.FC<TextareaProps> = ({
  label,
  error,
  helperText,
  fullWidth = true,
  rows = 4,
  required,
  value,
  onChange,
  placeholder,
  disabled,
  name,
}) => {
  return (
    <TextField
      label={label}
      error={!!error}
      helperText={error || helperText}
      fullWidth={fullWidth}
      required={required}
      multiline
      rows={rows}
      variant="outlined"
      value={value}
      onChange={onChange as unknown as React.ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>}
      placeholder={placeholder}
      disabled={disabled}
      name={name}
      sx={{
        '& .MuiOutlinedInput-root': {
          borderRadius: 2,
        },
      }}
    />
  );
};

interface SelectOption {
  value: string | number;
  label: string;
}

interface SelectProps {
  label?: string;
  error?: string;
  helperText?: string;
  options: SelectOption[];
  value?: string | number;
  onChange?: (value: string | number) => void;
  fullWidth?: boolean;
  required?: boolean;
  disabled?: boolean;
  name?: string;
  size?: 'small' | 'medium';
}

export const Select: React.FC<SelectProps> = ({
  label,
  error,
  helperText,
  options,
  value,
  onChange,
  fullWidth = true,
  required,
  disabled,
  name,
  size = 'medium',
}) => {
  return (
    <FormControl fullWidth={fullWidth} error={!!error} size={size} required={required}>
      {label && <InputLabel>{label}</InputLabel>}
      <MuiSelect
        value={value ?? ''}
        label={label}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        name={name}
        sx={{
          borderRadius: 2,
        }}
      >
        {options.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </MuiSelect>
      {(error || helperText) && (
        <FormHelperText>{error || helperText}</FormHelperText>
      )}
    </FormControl>
  );
};

export default Input;
