package <%= LanguageName %>.lang

import com.intellij.openapi.util.IconLoader

object <%= LanguageName %>Icons {
    @JvmField
    val Logo = IconLoader.getIcon("/icons/<%= language-id %>-logo.svg", javaClass)
}
