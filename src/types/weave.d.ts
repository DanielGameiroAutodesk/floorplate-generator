/**
 * TypeScript declarations for Weave web components
 * Reference: https://storybook.weave.autodesk.com/
 */

declare namespace JSX {
  interface IntrinsicElements {
    'weave-button': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        variant?: 'outlined' | 'flat' | 'solid';
        density?: 'high' | 'medium';
        type?: 'button' | 'submit' | 'reset';
        disabled?: boolean;
        'icon-position'?: 'left' | 'right';
      },
      HTMLElement
    >;

    'weave-select': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        placeholder?: string;
        value?: string;
        disabled?: boolean;
      },
      HTMLElement
    >;

    'weave-select-option': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        value?: string;
        selected?: boolean;
        disabled?: boolean;
      },
      HTMLElement
    >;

    'weave-checkbox': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        checked?: boolean;
        label?: string;
        disabled?: boolean;
        indeterminate?: boolean;
      },
      HTMLElement
    >;

    'weave-input': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        type?: 'text' | 'number' | 'password' | 'email' | 'search';
        placeholder?: string;
        value?: string | number;
        disabled?: boolean;
        readonly?: boolean;
        min?: number;
        max?: number;
        step?: number;
      },
      HTMLElement
    >;

    'weave-slider': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        min?: number;
        max?: number;
        value?: number;
        step?: number;
        disabled?: boolean;
      },
      HTMLElement
    >;

    'weave-toggle': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        checked?: boolean;
        disabled?: boolean;
        label?: string;
      },
      HTMLElement
    >;

    'weave-tooltip': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        content?: string;
        position?: 'top' | 'bottom' | 'left' | 'right';
      },
      HTMLElement
    >;

    'weave-icon': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        name?: string;
        size?: 'small' | 'medium' | 'large';
      },
      HTMLElement
    >;

    'weave-spinner': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        size?: 'small' | 'medium' | 'large';
      },
      HTMLElement
    >;
  }
}

// Event types for Weave components
interface WeaveSelectChangeEvent extends CustomEvent {
  detail: {
    value: string;
  };
}

interface WeaveSliderChangeEvent extends CustomEvent {
  detail: {
    value: number;
  };
}

interface WeaveInputChangeEvent extends CustomEvent {
  detail: {
    value: string;
  };
}

interface WeaveCheckboxChangeEvent extends CustomEvent {
  detail: {
    checked: boolean;
  };
}

// Global augmentation for event listeners
declare global {
  interface HTMLElementEventMap {
    'weave-select-change': WeaveSelectChangeEvent;
    'weave-slider-change': WeaveSliderChangeEvent;
    'weave-input-change': WeaveInputChangeEvent;
    'weave-checkbox-change': WeaveCheckboxChangeEvent;
  }
}

export {};
