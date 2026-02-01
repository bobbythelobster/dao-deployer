/**
 * Card Component Tests
 * Tests for the Card UI component
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { render, screen, cleanup } from '@solidjs/testing-library';
import { Card } from '../../src/components/Card';

describe('Card Component', () => {
  beforeEach(() => {
    cleanup();
  });

  it('should render children content', () => {
    render(() => (
      <Card>
        <p>Card content</p>
      </Card>
    ));
    
    expect(screen.getByText('Card content')).toBeDefined();
  });

  it('should render with title', () => {
    render(() => (
      <Card title="Card Title">
        <p>Content</p>
      </Card>
    ));
    
    expect(screen.getByText('Card Title')).toBeDefined();
  });

  it('should render with subtitle', () => {
    render(() => (
      <Card title="Title" subtitle="Subtitle text">
        <p>Content</p>
      </Card>
    ));
    
    expect(screen.getByText('Subtitle text')).toBeDefined();
  });

  it('should render with footer', () => {
    render(() => (
      <Card 
        title="Title"
        footer={<button>Action</button>}
      >
        <p>Content</p>
      </Card>
    ));
    
    expect(screen.getByText('Action')).toBeDefined();
  });

  it('should apply custom className', () => {
    render(() => (
      <Card class="custom-card">
        <p>Content</p>
      </Card>
    ));
    
    const card = screen.getByText('Content').closest('.card');
    expect(card?.classList.contains('custom-card')).toBe(true);
  });

  it('should render with different variants', () => {
    const { rerender } = render(() => (
      <Card variant="default">
        <p>Default</p>
      </Card>
    ));
    
    let card = screen.getByText('Default').closest('.card');
    expect(card?.classList.contains('card-default')).toBe(true);

    rerender(() => (
      <Card variant="outlined">
        <p>Outlined</p>
      </Card>
    ));
    
    card = screen.getByText('Outlined').closest('.card');
    expect(card?.classList.contains('card-outlined')).toBe(true);

    rerender(() => (
      <Card variant="elevated">
        <p>Elevated</p>
      </Card>
    ));
    
    card = screen.getByText('Elevated').closest('.card');
    expect(card?.classList.contains('card-elevated')).toBe(true);
  });

  it('should handle click events on card', async () => {
    let clicked = false;
    const handleClick = () => { clicked = true; };
    
    render(() => (
      <Card onClick={handleClick}>
        <p>Clickable card</p>
      </Card>
    ));
    
    const card = screen.getByText('Clickable card').closest('.card');
    await fireEvent.click(card!);
    
    expect(clicked).toBe(true);
  });

  it('should render with image header', () => {
    render(() => (
      <Card 
        image="https://example.com/image.png"
        title="Image Card"
      >
        <p>Content</p>
      </Card>
    ));
    
    const img = screen.getByAltText('Image Card');
    expect(img).toBeDefined();
    expect(img.getAttribute('src')).toBe('https://example.com/image.png');
  });

  it('should render loading state', () => {
    render(() => (
      <Card loading>
        <p>Content</p>
      </Card>
    ));
    
    expect(screen.getByTestId('card-skeleton')).toBeDefined();
  });
});
