import React from 'react';
import Link from '@docusaurus/Link';
import {findFirstCategoryLink} from '@docusaurus/theme-common/internal';

function EntryLayout({href, number, title}) {
  return (
    <Link href={href} className="notebookIndexEntry">
      <span className="notebookIndexNumber">{number}</span>
      <span className="notebookIndexTitle">{title}</span>
      <span className="notebookIndexArrow">→</span>
    </Link>
  );
}

function CardCategory({item, number}) {
  const href = findFirstCategoryLink(item);
  // Unexpected: categories that don't have a link have been filtered upfront
  if (!href) {
    return null;
  }
  return <EntryLayout href={href} number={number} title={item.label} />;
}

function CardLink({item, number}) {
  return <EntryLayout href={item.href} number={number} title={item.label} />;
}

export default function DocCard({item, index}) {
  const number = String((index ?? 0) + 1).padStart(2, '0');
  switch (item.type) {
    case 'link':
      return <CardLink item={item} number={number} />;
    case 'category':
      return <CardCategory item={item} number={number} />;
    default:
      throw new Error(`unknown item type ${JSON.stringify(item)}`);
  }
}
