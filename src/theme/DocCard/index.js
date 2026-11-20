import React from 'react';
import Link from '@docusaurus/Link';
import {findFirstCategoryLink} from '@docusaurus/theme-common/internal';

function EntryLayout({href, title}) {
  return (
    <li className="compactIndexItem">
      <Link href={href} className="compactIndexLink">
        {title}
      </Link>
    </li>
  );
}

function CardCategory({item}) {
  const href = findFirstCategoryLink(item);
  // Unexpected: categories that don't have a link have been filtered upfront
  if (!href) {
    return null;
  }
  return <EntryLayout href={href} title={item.label} />;
}

function CardLink({item}) {
  return <EntryLayout href={item.href} title={item.label} />;
}

export default function DocCard({item}) {
  switch (item.type) {
    case 'link':
      return <CardLink item={item} />;
    case 'category':
      return <CardCategory item={item} />;
    default:
      throw new Error(`unknown item type ${JSON.stringify(item)}`);
  }
}
