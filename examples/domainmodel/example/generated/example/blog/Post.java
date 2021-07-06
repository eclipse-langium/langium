package example.blog;

class Post extends HasAuthor {
    private String title;
    private String content;
    private Comment[] comments;

    public void setTitle(String title) {
        this.title = title;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public void setComments(Comment[] comments) {
        this.comments = comments;
    }

    public String getTitle() {
        return title;
    }

    public String getContent() {
        return content;
    }

    public Comment[] getComments() {
        return comments;
    }
}
