import React from 'react';
import Link from '@docusaurus/Link';
import {useBlogPost} from '@docusaurus/theme-common/internal';
import BlogPostItemContainer from '@theme/BlogPostItem/Container';
import BlogPostItemHeader from '@theme/BlogPostItem/Header';
import BlogPostItemContent from '@theme/BlogPostItem/Content';
import BlogPostItemFooter from '@theme/BlogPostItem/Footer';

import styles from './styles.module.css';

export default function BlogPostItem({children, className}) {
  const {metadata, isBlogPostPage} = useBlogPost();

  if (!isBlogPostPage) {
    const {permalink, title, formattedDate} = metadata;
    return (
      <Link to={permalink} className={styles.listItem}>
        <span className={styles.listItemTitle}>{title}</span>
        <span className={styles.listItemDate}>{formattedDate}</span>
      </Link>
    );
  }

  return (
    <BlogPostItemContainer className={className}>
      <BlogPostItemHeader />
      <BlogPostItemContent>{children}</BlogPostItemContent>
      <BlogPostItemFooter />
    </BlogPostItemContainer>
  );
}
