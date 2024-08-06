package <%= LanguageName %>.lang

import com.intellij.openapi.fileTypes.LanguageFileType
import javax.swing.Icon

object <%= LanguageName %>FileType : LanguageFileType(<%= LanguageName %>Language.INSTANCE) {
    val INSTANCE = <%= LanguageName %>FileType

    override fun getName(): String = "<%= LanguageName %>"

    override fun getDescription(): String = "<%= LanguageName %> language file"

    override fun getDefaultExtension(): String = "<%= file-extension-default %>"

    override fun getIcon(): Icon = <%= LanguageName %>Icons.Logo
}
