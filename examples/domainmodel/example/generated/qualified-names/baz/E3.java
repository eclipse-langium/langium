package base.baz;

class E3 {
    private E4 this;
    private foo.bar.E2 other;
    private nested.E5 nested;

    public void setThis(E4 this) {
        this.this = this;
    }

    public void setOther(foo.bar.E2 other) {
        this.other = other;
    }

    public void setNested(nested.E5 nested) {
        this.nested = nested;
    }

    public E4 getThis() {
        return this;
    }

    public foo.bar.E2 getOther() {
        return other;
    }

    public nested.E5 getNested() {
        return nested;
    }
}
