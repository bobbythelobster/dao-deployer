/**
 * Button Component Tests
 * Tests for the reusable Button component
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { render, fireEvent, screen, cleanup } from '@solidjs/testing-library';
import { Button } from '../../src/components/Button';

describe('Button Component', () => {
  beforeEach(() => {
    cleanup();
  });

  it('should render with default props', () => {
    render(() => <Button>Click me</Button>);
    
    const button = screen.getByText('Click me');
    expect(button).toBeDefined();
    expect(button.tagName).toBe('BUTTON');
  });

  it('should render with custom className', () => {
    render(() => <Button class="custom-class">Click me</Button>);
    
    const button = screen.getByText('Click me');
    expect(button.classList.contains('custom-class')).toBe(true);
  });

  it('should handle click events', async () => {
    let clicked = false;
    const handleClick = () => { clicked = true; };
    
    render(() => <Button onClick={handleClick}>Click me</Button>);
    
    const button = screen.getByText('Click me');
    await fireEvent.click(button);
    
    expect(clicked).toBe(true);
  });

  it('should be disabled when disabled prop is true', () => {
    render(() => <Button disabled>Disabled</Button>);
    
    const button = screen.getByText('Disabled') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('should render different variants', () => {
    const { rerender } = render(() => <Button variant="primary">Primary</Button>);
    let button = screen.getByText('Primary');
    expect(button.classList.contains('btn-primary')).toBe(true);

    rerender(() => <Button variant="secondary">Secondary</Button>);
    button = screen.getByText('Secondary');
    expect(button.classList.contains('btn-secondary')).toBe(true);

    rerender(() => <Button variant="danger">Danger</Button>);
    button = screen.getByText('Danger');
    expect(button.classList.contains('btn-danger')).toBe(true);
  });

  it('should render different sizes', () => {
    const { rerender } = render(() => <Button size="sm">Small</Button>);
    let button = screen.getByText('Small');
    expect(button.classList.contains('btn-sm')).toBe(true);

    rerender(() => <Button size="md">Medium</Button>);
    button = screen.getByText('Medium');
    expect(button.classList.contains('btn-md')).toBe(true);

    rerender(() => <Button size="lg">Large</Button>);
    button = screen.getByText('Large');
    expect(button.classList.contains('btn-lg')).toBe(true);
  });

  it('should show loading state', () => {
    render(() => <Button loading>Loading</Button>);
    
    const button = screen.getByText('Loading') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.querySelector('.spinner')).toBeDefined();
  });

  it('should render as different element types', () => {
    render(() => <Button as="a" href="/test">Link Button</Button>);
    
    const link = screen.getByText('Link Button');
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('/test');
  });

  it('should pass through data attributes', () => {
    render(() => <Button data-testid="test-button">Test</Button>);
    
    const button = screen.getByTestId('test-button');
    expect(button).toBeDefined();
  });
});
