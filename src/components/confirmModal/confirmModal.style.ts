import styled from "styled-components";

export const ModalContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  text-align: center;
`;

export const IconWrapper = styled.div`
  border-radius: 9999px;
  background-color: #fee2e2;
  padding: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;

  svg {
    height: 1.5rem;
    width: 1.5rem;
    color: #dc2626;
  }
`;

export const TextContainer = styled.div``;

export const ModalTitle = styled.h3`
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
`;

export const ModalDesc = styled.p`
  font-size: 0.875rem;
  color: #6b7280;
  margin-top: 0.25rem;
`;

export const ActionWrapper = styled.div`
  display: flex;
  gap: 0.75rem;
  width: 100%;

  button {
    flex: 1;
  }
`;
