import React from 'react';
import DocItemPaginator from '@theme/DocItem/Paginator';
import DocVersionBanner from '@theme/DocVersionBanner';
import DocVersionBadge from '@theme/DocVersionBadge';
import DocItemFooter from '@theme/DocItem/Footer';
import DocItemContent from '@theme/DocItem/Content';
import DocBreadcrumbs from '@theme/DocBreadcrumbs';
import styles from './styles.module.css';

// The right-hand "On this page" table of contents (desktop column and
// mobile dropdown alike) is dropped entirely rather than hidden with CSS,
// so the content column actually reclaims that width instead of leaving
// it blank. Single reading column, nothing competing for attention.
export default function DocItemLayout({children}) {
  return (
    <div className="row">
      <div className="col">
        <DocVersionBanner />
        <div className={styles.docItemContainer}>
          <article>
            <DocBreadcrumbs />
            <DocVersionBadge />
            <DocItemContent>{children}</DocItemContent>
            <DocItemFooter />
          </article>
          <DocItemPaginator />
        </div>
      </div>
    </div>
  );
}
