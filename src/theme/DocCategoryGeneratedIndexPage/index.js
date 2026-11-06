import React from 'react';
import {
  PageMetadata,
  useCurrentSidebarCategory,
} from '@docusaurus/theme-common';
import useBaseUrl from '@docusaurus/useBaseUrl';
import {useLocation} from '@docusaurus/router';
import Link from '@docusaurus/Link';
import DocCardList from '@theme/DocCardList';
import DocPaginator from '@theme/DocPaginator';
import DocVersionBanner from '@theme/DocVersionBanner';
import DocVersionBadge from '@theme/DocVersionBadge';
import DocBreadcrumbs from '@theme/DocBreadcrumbs';
import Heading from '@theme/Heading';
import {AVAILABLE_REELS_TOPICS} from '@site/src/data/reels';
import styles from './styles.module.css';

function categorySlugFromPath(pathname) {
  const match = pathname.match(/\/docs\/category\/([^/]+)\/?$/);
  return match ? match[1] : null;
}

function DocCategoryGeneratedIndexPageMetadata({categoryGeneratedIndex}) {
  return (
    <PageMetadata
      title={categoryGeneratedIndex.title}
      description={categoryGeneratedIndex.description}
      keywords={categoryGeneratedIndex.keywords}
      image={useBaseUrl(categoryGeneratedIndex.image)}
    />
  );
}

function DocCategoryGeneratedIndexPageContent({categoryGeneratedIndex}) {
  const category = useCurrentSidebarCategory();
  const location = useLocation();
  const topicSlug = categorySlugFromPath(location.pathname);
  const hasReels = topicSlug && AVAILABLE_REELS_TOPICS.includes(topicSlug);
  return (
    <div className={styles.generatedIndexPage}>
      <DocVersionBanner />
      <DocBreadcrumbs />
      <DocVersionBadge />
      <header className={styles.header}>
        <Heading as="h1" className={styles.title}>
          {categoryGeneratedIndex.title}
        </Heading>
        {categoryGeneratedIndex.description && (
          <p className={styles.description}>
            {categoryGeneratedIndex.description}
          </p>
        )}
      </header>
      <article className="margin-top--lg">
        <div className={styles.listHeader}>
          <span className={styles.listLabel}>Contents</span>
          <div className={styles.listHeaderRight}>
            {hasReels && (
              <Link to={`/reels?topic=${topicSlug}`} className={styles.reelsLink}>
                Read as Reels →
              </Link>
            )}
            <span className={styles.listCount}>
              {String(category.items.length).padStart(2, '0')} sections
            </span>
          </div>
        </div>
        <DocCardList items={category.items} />
      </article>
      <footer className="margin-top--lg">
        <DocPaginator
          previous={categoryGeneratedIndex.navigation.previous}
          next={categoryGeneratedIndex.navigation.next}
        />
      </footer>
    </div>
  );
}

export default function DocCategoryGeneratedIndexPage(props) {
  return (
    <>
      <DocCategoryGeneratedIndexPageMetadata {...props} />
      <DocCategoryGeneratedIndexPageContent {...props} />
    </>
  );
}
