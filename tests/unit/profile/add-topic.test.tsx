// F-14 AddTopicForm 단위 테스트 (AC2)
// 신규 토픽 추가 폼 검증 + 중복 방지

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AddTopicForm, type AddTopicFormProps } from '@/components/profile/AddTopicForm';

// ─── U-14-08: AddTopicForm 기본 렌더링 ──────────────────────────────────────

describe('AddTopicForm — 기본 렌더링 (U-14-08)', () => {
  const defaultProps: AddTopicFormProps = {
    existingTopics: ['React', 'TypeScript'],
    onAdd: vi.fn(),
  };

  it('U-14-08-1: 입력 필드가 렌더링된다', () => {
    render(<AddTopicForm {...defaultProps} />);
    expect(screen.getByTestId('add-topic-input')).toBeInTheDocument();
  });

  it('U-14-08-2: 추가 버튼이 렌더링된다', () => {
    render(<AddTopicForm {...defaultProps} />);
    expect(screen.getByTestId('add-topic-submit')).toBeInTheDocument();
  });
});

// ─── U-14-09: 입력 검증 (AC2) ────────────────────────────────────────────────

describe('AddTopicForm — 입력 검증 (U-14-09)', () => {
  it('U-14-09-1: 빈 문자열 제출 시 에러 메시지가 표시된다', () => {
    const onAdd = vi.fn();
    render(<AddTopicForm existingTopics={[]} onAdd={onAdd} />);

    const submitBtn = screen.getByTestId('add-topic-submit');
    fireEvent.click(submitBtn);

    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByTestId('add-topic-error')).toBeInTheDocument();
  });

  it('U-14-09-2: 공백만 입력 후 제출 시 에러 메시지가 표시된다', () => {
    const onAdd = vi.fn();
    render(<AddTopicForm existingTopics={[]} onAdd={onAdd} />);

    const input = screen.getByTestId('add-topic-input');
    fireEvent.change(input, { target: { value: '   ' } });

    const submitBtn = screen.getByTestId('add-topic-submit');
    fireEvent.click(submitBtn);

    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByTestId('add-topic-error')).toBeInTheDocument();
  });

  it('U-14-09-3: 중복 토픽 제출 시 에러 메시지가 표시된다', () => {
    const onAdd = vi.fn();
    render(<AddTopicForm existingTopics={['React']} onAdd={onAdd} />);

    const input = screen.getByTestId('add-topic-input');
    fireEvent.change(input, { target: { value: 'React' } });

    const submitBtn = screen.getByTestId('add-topic-submit');
    fireEvent.click(submitBtn);

    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByTestId('add-topic-error')).toBeInTheDocument();
  });

  it('U-14-09-4: 유효한 토픽 제출 시 onAdd가 호출된다', () => {
    const onAdd = vi.fn();
    render(<AddTopicForm existingTopics={['React']} onAdd={onAdd} />);

    const input = screen.getByTestId('add-topic-input');
    fireEvent.change(input, { target: { value: 'Vue.js' } });

    const submitBtn = screen.getByTestId('add-topic-submit');
    fireEvent.click(submitBtn);

    expect(onAdd).toHaveBeenCalledWith('Vue.js');
  });

  it('U-14-09-5: 유효한 토픽 제출 후 입력 필드가 초기화된다', () => {
    const onAdd = vi.fn();
    render(<AddTopicForm existingTopics={[]} onAdd={onAdd} />);

    const input = screen.getByTestId('add-topic-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Python' } });
    fireEvent.click(screen.getByTestId('add-topic-submit'));

    expect(input.value).toBe('');
  });

  it('U-14-09-6: 대소문자 무시 중복 검사 — "react"는 "React" 중복으로 처리된다', () => {
    const onAdd = vi.fn();
    render(<AddTopicForm existingTopics={['React']} onAdd={onAdd} />);

    const input = screen.getByTestId('add-topic-input');
    fireEvent.change(input, { target: { value: 'react' } });
    fireEvent.click(screen.getByTestId('add-topic-submit'));

    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByTestId('add-topic-error')).toBeInTheDocument();
  });
});
