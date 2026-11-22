"use client";

import {
  forwardRef,
  type HTMLAttributes,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
} from "react";
import {
  Body,
  Caption,
  Cell,
  Foot,
  Head,
  HeadCell,
  Row,
  Scroller,
  StyledTable,
} from "./table.styles";

const Table = forwardRef<HTMLTableElement, HTMLAttributes<HTMLTableElement>>(function Table(
  props,
  ref,
) {
  return (
    <Scroller data-ui="table-scroller">
      <StyledTable ref={ref} data-ui="table" {...props} />
    </Scroller>
  );
});

const TableHeader = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  function TableHeader(props, ref) {
    return <Head ref={ref} {...props} />;
  },
);

const TableBody = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  function TableBody(props, ref) {
    return <Body ref={ref} {...props} />;
  },
);

const TableFooter = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  function TableFooter(props, ref) {
    return <Foot ref={ref} {...props} />;
  },
);

const TableRow = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(
  function TableRow(props, ref) {
    return <Row ref={ref} {...props} />;
  },
);

const TableHead = forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(
  function TableHead(props, ref) {
    return <HeadCell ref={ref} {...props} />;
  },
);

const TableCell = forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(
  function TableCell(props, ref) {
    return <Cell ref={ref} {...props} />;
  },
);

const TableCaption = forwardRef<HTMLTableCaptionElement, HTMLAttributes<HTMLTableCaptionElement>>(
  function TableCaption(props, ref) {
    return <Caption ref={ref} {...props} />;
  },
);

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
