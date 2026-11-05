import React from 'react';
import Link from '@docusaurus/Link';
import {
  findFirstCategoryLink,
  useDocById,
} from '@docusaurus/theme-common/internal';
import {translate} from '@docusaurus/Translate';

function EntryLayout({href, number, title, description}) {
  return (
    <Link href={href} className="notebookIndexEntry">
      <span className="notebookIndexNumber">{number}</span>
      <span className="notebookIndexBody">
        <span className="notebookIndexTitleRow">
          <span className="notebookIndexTitle">{title}</span>
          <span className="notebookIndexLeader" />
        </span>
        {description && (
          <span className="notebookIndexDescription">{description}</span>
        )}
      </span>
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
  return (
    <EntryLayout
      href={href}
      number={number}
      title={item.label}
      description={
        item.description ??
        translate(
          {
            message: '{count} items',
            id: 'theme.docs.DocCard.categoryDescription',
            description:
              'The default description for a category card in the generated index about how many items this category includes',
          },
          {count: item.items.length},
        )
      }
    />
  );
}

function CardLink({item, number}) {
  const doc = useDocById(item.docId ?? undefined);
  return (
    <EntryLayout
      href={item.href}
      number={number}
      title={item.label}
      description={item.description ?? doc?.description}
    />
  );
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
