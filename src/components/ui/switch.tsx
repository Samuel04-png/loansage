import * as React from "react"
import { useFormContext } from "react-hook-form"
import { cn } from "../../lib/utils"

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, checked: controlledChecked, onCheckedChange, disabled, name, onChange, onBlur, ...props }, ref) => {
    // Try to get form context if available (for react-hook-form)
    // This allows Switch to work with form.register() without needing checked prop
    let formValue: boolean | undefined;
    try {
      const formContext = useFormContext();
      if (formContext && name) {
        formValue = formContext.watch(name);
      }
    } catch {
      // Not in a form context, that's okay - component can still work
    }

    // Support both controlled and uncontrolled modes
    // Priority: controlledChecked > formValue > internal state
    const [internalChecked, setInternalChecked] = React.useState(false);
    const isControlled = controlledChecked !== undefined;
    const checked = isControlled ? controlledChecked : (formValue !== undefined ? formValue : internalChecked);
    const inputRef = React.useRef<HTMLInputElement>(null);

    // Combine refs: forward the ref from react-hook-form and maintain internal ref
    React.useEffect(() => {
      if (typeof ref === 'function') {
        ref(inputRef.current);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLInputElement | null>).current = inputRef.current;
      }
    }, [ref]);

    const handleClick = () => {
      if (disabled) return;
      
      const newChecked = !checked;
      
      if (!isControlled) {
        setInternalChecked(newChecked);
      }
      
      // Call onCheckedChange if provided (direct usage)
      if (onCheckedChange) {
        onCheckedChange(newChecked);
      }
      
      // Call onChange if provided (react-hook-form register)
      // react-hook-form expects an event with target.checked for boolean inputs
      if (onChange && inputRef.current) {
        // Create a synthetic event that react-hook-form expects
        const syntheticEvent = {
          target: {
            checked: newChecked,
            value: newChecked,
            name: name || '',
            type: 'checkbox',
          },
          currentTarget: {
            checked: newChecked,
            value: newChecked,
            name: name || '',
            type: 'checkbox',
          },
        } as React.ChangeEvent<HTMLInputElement>;
        
        // Update the hidden input's checked state
        inputRef.current.checked = newChecked;
        onChange(syntheticEvent);
      }
    };

    const handleBlur = () => {
      if (onBlur) {
        onBlur();
      }
    };

    // Separate button props from input props
    const { 
      onClick, 
      onFocus, 
      onKeyDown, 
      onKeyUp, 
      onMouseDown, 
      onMouseUp,
      ...buttonProps 
    } = props as any;

    return (
      <>
        {/* Hidden input for react-hook-form */}
        <input
          type="checkbox"
          ref={inputRef}
          name={name}
          checked={checked}
          onChange={() => {}} // Handled by button click
          onBlur={handleBlur}
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
        />
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          disabled={disabled}
          onClick={handleClick}
          className={cn(
            "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
            checked ? "bg-primary-600" : "bg-neutral-200 dark:bg-neutral-700",
            className
          )}
          {...buttonProps}
        >
          <span
            className={cn(
              "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform",
              checked ? "translate-x-5" : "translate-x-0"
            )}
          />
        </button>
      </>
    );
  }
);
Switch.displayName = "Switch"

export { Switch }

