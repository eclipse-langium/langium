package base;

class Blog {
    private String title;
    private Post[] posts;

    public void setTitle(String title) {
        this.title = title;
    }

    public void setPosts(Post[] posts) {
        this.posts = posts;
    }

    public String getTitle() {
        return title;
    }

    public Post[] getPosts() {
        return posts;
    }
}
