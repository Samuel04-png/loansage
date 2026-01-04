import * as React from 'react';
import { cn } from '../../lib/utils';
import { Label, LabelProps } from './label';
import { Input, InputProps } from './input';
import { Textarea, TextareaProps } from './textarea';
import { Select, SelectProps } from './select';
import { AlertCircle } from 'lucide-react';

export interface FormFieldProps {
  label?: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  className?: string;
  htmlFor?: string;
}

export interface FormFieldContextValue {
  error?: string;
  required?: boolean;
}

const FormFieldContext = React.createContext<FormFieldContextValue>({});

export function useFormField() {
  return React.useContext(FormFieldContext);
}

const FormFieldRoot = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & FormFieldProps
>(({ label, required, error, helperText, className, htmlFor, children, ...props }, ref) => {
  return (
    <FormFieldContext.Provider value={{ error, required }}>
      <div ref={ref} className={cn('space-y-2', className)} {...props}>
        {label && (
          <Label htmlFor={htmlFor} required={required} className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {label}
          </Label>
        )}
        {children}
        {error && (
          <p className="text-sm text-[#EF4444] dark:text-red-400 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </p>
        )}
        {helperText && !error && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {helperText}
          </p>
        )}
      </div>
    </FormFieldContext.Provider>
  );
});
FormFieldRoot.displayName = 'FormFieldRoot';

const FormFieldLabel = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => {
    const { required } = useFormField();
    return <Label ref={ref} required={required} className={className} {...props} />;
  }
);
FormFieldLabel.displayName = 'FormFieldLabel';

const FormFieldInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    const { error } = useFormField();
    return (
      <Input
        ref={ref}
        className={cn(
          error && 'border-[#EF4444] dark:border-red-500 focus-visible:border-[#EF4444] dark:focus-visible:border-red-500 focus-visible:ring-red-500/20',
          className
        )}
        {...props}
      />
    );
  }
);
FormFieldInput.displayName = 'FormFieldInput';

const FormFieldTextarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    const { error } = useFormField();
    return (
      <Textarea
        ref={ref}
        className={cn(
          error && 'border-[#EF4444] dark:border-red-500 focus-visible:border-[#EF4444] dark:focus-visible:border-red-500 focus-visible:ring-red-500/20',
          className
        )}
        {...props}
      />
    );
  }
);
FormFieldTextarea.displayName = 'FormFieldTextarea';

const FormFieldSelect = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, ...props }, ref) => {
    const { error } = useFormField();
    return (
      <Select
        ref={ref}
        className={cn(
          error && 'border-[#EF4444] dark:border-red-500 focus-visible:border-[#EF4444] dark:focus-visible:border-red-500 focus-visible:ring-red-500/20',
          className
        )}
        {...props}
      />
    );
  }
);
FormFieldSelect.displayName = 'FormFieldSelect';

export const FormField = Object.assign(FormFieldRoot, {
  Label: FormFieldLabel,
  Input: FormFieldInput,
  Textarea: FormFieldTextarea,
  Select: FormFieldSelect,
});
