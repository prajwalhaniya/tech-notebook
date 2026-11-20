import React from 'react';
import Link from '@docusaurus/Link';
import {translate} from '@docusaurus/Translate';
import {PageMetadata} from '@docusaurus/theme-common';
import Layout from '@theme/Layout';
function Year({year, posts}) {
  return (
    <>
      <h3>{year}</h3>
      <ul>
        {posts.map((post) => (
          <li key={post.metadata.date}>
            <Link to={post.metadata.permalink}>
              {post.metadata.formattedDate} - {post.metadata.title}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
function YearsSection({years}) {
  // Single column, not the stock 3-wide "col col--4" grid: the spec names
  // prajwalhaniya.in/post explicitly as the shape to match — a bare,
  // single-column, year-grouped list, not a card grid.
  return (
    <section className="margin-vert--lg">
      <div className="container">
        <div className="row">
          <div className="col col--8 col--offset-2">
            {years.map((_props, idx) => (
              <div key={idx} className="margin-vert--lg">
                <Year {..._props} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
function listPostsByYears(blogPosts) {
  const postsByYear = blogPosts.reduceRight((posts, post) => {
    const year = post.metadata.date.split('-')[0];
    const yearPosts = posts.get(year) ?? [];
    return posts.set(year, [post, ...yearPosts]);
  }, new Map());
  // reduceRight walks blogPosts (already newest-first) from its end
  // backward, so the Map's insertion order comes out oldest-year-first;
  // Array.from() preserves Map insertion order, so without reversing here
  // the page renders its oldest year at the top — exactly backwards from
  // the reference site (and from ordinary reader expectation for an
  // archive) that the spec named as the shape to match.
  return Array.from(postsByYear, ([year, posts]) => ({
    year,
    posts,
  })).reverse();
}
export default function BlogArchive({archive}) {
  const title = translate({
    id: 'theme.blog.archive.title',
    message: 'Archive',
    description: 'The page & hero title of the blog archive page',
  });
  const description = translate({
    id: 'theme.blog.archive.description',
    message: 'Archive',
    description: 'The page & hero description of the blog archive page',
  });
  const years = listPostsByYears(archive.blogPosts);
  return (
    <>
      <PageMetadata title={title} description={description} />
      <Layout>
        <header className="hero hero--primary">
          <div className="container">
            <h1 className="hero__title">{title}</h1>
            <p className="hero__subtitle">{description}</p>
          </div>
        </header>
        <main>{years.length > 0 && <YearsSection years={years} />}</main>
      </Layout>
    </>
  );
}
